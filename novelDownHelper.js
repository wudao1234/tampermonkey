// ==UserScript==
// @name         novelDownHelper
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  小说下载辅助
// @author       You
// @include      http://www.paoshu8.com/*/
// @include      https://book.qidian.com/info/*
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @run-at document-end
// ==/UserScript==

(function() {
    'use strict';

    // 起点
    const qidian = {
        cPattern:'Content">((\n|.)*?)<\/div>',
        getName(){
            this.name = document.getElementsByClassName("book-info ")[0].getElementsByTagName("em")[0].innerText
            return this
        },
        getChapter(){
            const volume = document.getElementsByClassName("volume")
            for(let i=0;i<volume.length;i++){
                const li = volume[i].getElementsByTagName("li")
                for(let j=0;j<li.length;j++){
                    const a = li[j].getElementsByTagName("a")[0]
                    const title = {name:a.innerText,href:a.href}
                    this.chapter.push(title)
                }
            }
            progressBar.init(this.chapter.length)
            return this
        }
    }

    //paoshu
    const paoshu = {
        cPattern:'content">((\n|.)*?)<\/div>',
        //获取目录
        getChapter(){
            const dt = document.getElementById("list").getElementsByTagName("dt")[1]
            let dd = dt.nextElementSibling
            while(dd!=null){
                const a = dd.getElementsByTagName("a")[0]
                const title = {name:a.innerText,href:a.href}
                this.chapter.push(title)
                dd = dd.nextElementSibling
            }
            progressBar.init(this.chapter.length)
            return this
        },
        //小说名称
        getName(){
            this.name = document.getElementById("info").getElementsByTagName("h1")[0].innerText
            return this
        }
    }

    //进度条
    const progressBar = {
        bar :null,
        barColor :null,
        barNum :null,
        refresh(num=0,total){
            num = num<1?0:num
            this.barNum.innerText = num+'/'+total
            this.barColor.style.backgroundImage = 'linear-gradient( to right, #a8e063 '+Math.ceil(num*100/total)+'%, #dbdbdb 0%)'
        },
        init(total){
            this.bar =document.createElement('div')
            this.bar.style.bottom = '10px'
            this.bar.style.width = '15%'
            this.bar.style.height = '5px'
            this.bar.style.position = 'fixed'
            this.bar.style.right = '0px'

            this.barColor = document.createElement('div')
            this.barColor.style.bottom = '5px'
            this.barColor.style.width = '80%'
            this.barColor.style.height = '5px'
            this.barColor.style.backgroundImage = 'linear-gradient( to right, #a8e063 0%, #dbdbdb 0%)'
            this.barColor.style.borderRadius = '5px'
            this.barColor.style.float = 'left'
            this.barColor.style.marginTop = '5px'

            this.barNum = document.createElement('span')
            this.barNum.innerText = '0/'+total
            this.bar.append(this.barColor)
            this.bar.append(this.barNum)
            document.body.append(this.bar)
        }
    }

    //小说
    const Novel = {
        name:'',
        chapter:[],
        cPattern:'',
        fail_chapter_index:[],
        //获取目录
        getChapter(){
            return this
        },
        //小说名称
        getName(){
            return this
        },
        //初始化
        init(){
            return this.getChapter().getName()
        },
        //获取章节内容
        getContent(index,isSetTimeout){
            return new Promise((resolve,reject) => {
                GM_xmlhttpRequest({
                    url:this.chapter[index].href,
                    onload:response=>{
                        const p_pattern = '<p>(.*?)<\/p>'
                        this.chapter[index].content = response.responseText.match(new RegExp(this.cPattern))[1].match(new RegExp(p_pattern,'g')).map(x => x.match(new RegExp(p_pattern))[1]).join('\n\n')
                        const del_index = this.fail_chapter_index.indexOf(index);
                        if(del_index>-1){
                            this.fail_chapter_index.splice(del_index, 1);
                        }
                        resolve(index)
                    }
                })
                if(isSetTimeout){
                    setTimeout(reject,2*1000,index)
                }
            });
        },
        //异步获取章节内容
        asynDown(i,e,isSetTimeout=true){
            const end = e<=this.chapter.length?e:this.chapter.length
            let promises = []
            for(;i<end;i++){
                promises.push(this.getContent(i,isSetTimeout))
            }
            return Promise.allSettled(promises).
            then((results) => results.forEach((result) => {
                if(result.status==='rejected'){
                    const index = result.reason
                    this.fail_chapter_index.push(index)
                }
            }));
        },
        //下载小说到浏览器
        downBook: async function(){
            const total = this.chapter.length
            let step=20,i=0
            for(;i<this.chapter.length;i+=step){
                await this.asynDown(i,i+step)
                const num = i-this.fail_chapter_index.length
                progressBar.refresh(num,total)
            }
            while(this.fail_chapter_index.length>0){
                const i = this.fail_chapter_index[0]
                await this.asynDown(i,i+1,false)
                const num = total-this.fail_chapter_index.length
                progressBar.refresh(num,total)
            }
            progressBar.refresh(total,total)
            return Promise.resolve()
        },
        //下载小说到本地
        downLocal(){
            this.init().downBook().then(()=>{
                const aTag = document.createElement('a');
                const blob = new Blob(this.chapter.map(x => x.name + '\n\n' + x.content))
                aTag.download = this.name+'.txt';
                aTag.href = URL.createObjectURL(blob);
                aTag.click();
                URL.revokeObjectURL(blob);
            })
        }
    }

    //支持站点集合
    const webMap = new Map([
        ['book.qidian.com',qidian],
        ['www.paoshu8.com',paoshu]
    ])

    //加载站点配置
    Object.assign(Novel,webMap.get(window.location.host))

    //添加下载按钮
    GM_registerMenuCommand('down', function () {
        Novel.downLocal()
    }, 'D');

})();