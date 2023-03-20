// ==UserScript==
// @name         AutoCHAT
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Test
// @author       MonkeyJoy
// @match        https://chat.openai.com/chat*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=openai.com
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    /**
     * Delay asynchronously
     * @param {number} ms delay in milliseconds
     * @returns {Promise<void>}
     */
    async function sleep(ms) {
        return await new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, ms);
        })
    }

    function getDialogDOMList() {
        let ctx = document.querySelector("#__next > div.overflow-hidden.w-full.h-full.relative > div.flex > main > div.flex-1.overflow-hidden > div > div > div")
        if (ctx !== undefined) {
            let dialogs = [].slice.call(ctx.children, 1, -1)
            return dialogs
        } else {
            console.error("Couldn't find context.");
            return []
        }
    }

    async function getDialogDOMListText() {
        let list = getDialogDOMList()
        let text = []
        if (Array.isArray(list)) {
            for (let dom of list) {
                let getIndex = (dom)=>{
                    let index = dom.querySelector('.flex-grow.flex-shrink-0')
                    if (index==undefined) return [-1,-1]
                    let indexText = index.innerHTML;
                    if (indexText.indexOf('/')!=-1){
                        let [start,end] =  indexText.split("/");
                        return [Number.parseInt(start),Number.parseInt(end)]
                    }
                    return [-1,-1]
                }
                let [cur,total] = getIndex(dom)
                if (cur!=-1){
                    let [lbtn,rbtn] = dom.querySelectorAll('button')
                    while (cur!=1){
                        lbtn.click()
                        await sleep(300);
                        cur = getIndex(dom)[0];
                    }
                    text.push(dom.innerText);
                    for (;cur<total;++cur){
                        rbtn.click();
                        await sleep(300);
                        text.push(dom.innerText);
                    }
                }else{
                    text.push(dom.innerText);
                }
            }
        }
        return text;
    }

    function getDialogEditButton(list) {
        let btns = []
        if (Array.isArray(list)) {
            for (let index = 0; index < list.length; index += 2) {
                let dom = list[index];
                // #__next > div.overflow-hidden.w-full.h-full.relative > div.flex.h-full.flex-1.flex-col.md\:pl-\[260px\] > main > div.flex-1.overflow-hidden > div > div > div > div.group.w-full.text-gray-800.dark\:text-gray-100.border-b.border-black\/10.dark\:border-gray-900\/50.dark\:bg-gray-800 > div > div.relative.flex.w-\[calc\(100\%-50px\)\].flex-col.gap-1.md\:gap-3.lg\:w-\[calc\(100\%-115px\)\] > div.text-gray-400.flex.self-end.lg\:self-center.justify-center.mt-2.gap-3.md\:gap-4.lg\:gap-1.lg\:absolute.lg\:top-0.lg\:translate-x-full.lg\:right-0.lg\:mt-0.lg\:pl-2.visible
                let btnDiv = dom.querySelector("div.flex.self-end");
                if (btnDiv != undefined) {
                    let btn = btnDiv.querySelector('button');
                    btns.push(btn);
                } else {
                    btns.push(undefined)
                }
            }
        }
        return btns;
    }

    async function editDialog(index) {
        let doms = getDialogDOMList()
        let btns = getDialogEditButton(doms)
        if (btns.length > 0) {
            if (index >= btns.length) {
                console.error("Index out of range.");
                return;
            }
            if (index < 0) {
                index = doms.length + index;
            }
            let btn = btns[Math.floor(index / 2)];
            if (btn != undefined) {
                btn.click();
                await sleep(1000);
            }
            let list = getDialogDOMList()
            if (index%2!=0){
                if (index+1<list.length){
                    index++;
                }else{
                    index--;
                }
            }
            return getSaveAndSubmitAndCancelButton(list, index);
        } else {
            console.error("Empty context");
        }
    }

    // #__next > div.overflow-hidden.w-full.h-full.relative > div.flex.h-full.flex-1.flex-col.md\:pl-\[260px\] > main > div.flex-1.overflow-hidden > div > div > div > div.group.w-full.text-gray-800.dark\:text-gray-100.border-b.border-black\/10.dark\:border-gray-900\/50.dark\:bg-gray-800 > div > div.relative.flex.w-\[calc\(100\%-50px\)\].flex-col.gap-1.md\:gap-3.lg\:w-\[calc\(100\%-115px\)\] > div.flex.flex-grow.flex-col.gap-3 > div > button.btn.relative.btn-primary.mr-2
    function getSaveAndSubmitAndCancelButton(list, index) {
        let submit = list[index].querySelector('button.btn.btn-primary')
        let cancel = list[index].querySelector('button.btn.relative.btn-neutral')
        return [submit, cancel];
    }

    function getDialogInputField() {
        let field = document.querySelector('#__next > div.overflow-hidden.w-full.h-full.relative > div.flex.h-full.flex-1.flex-col > main > div.absolute.bottom-0.left-0.w-full.border-t')
        let btn = field.querySelector('button.btn')
        let input_field = field.querySelector('textarea')
        let sendbtn = field.querySelector('button.absolute.p-1')
        return [btn, input_field, sendbtn]
    }

    function sendText(text) {
        let [_, input, send] = getDialogInputField()
        if (input == undefined) {
            console.error("input couldn't find");
            return
        }
        input.value = text;
        send.click()
    }

    function checkStatus() {
        let [status, ,] = getDialogInputField()
        if (status == undefined) {
            return "init";
        }
        if (status.innerText.indexOf("Regenerate") != -1) {
            return "finished";
        }
        if (status.innerText.indexOf("Stop") != -1) {
            return "running";
        }
        return "error";
    }

    function createGlobalButton({
        text,
        onclick,
        index
    }){
        let autoDOM = document.createElement("button")
        autoDOM.innerText = text
        autoDOM.style = `
            position: fixed;
            bottom: 5px;
            right: ${index*105+5}px;
            height: 35px;
            font-size: 12px;
            border-radius: 2px;
            backdrop-filter: blur(2px);
            width: 100px;
            outline: none;
            border: none;
            z-index: 9999;
            background: rgba(255,255,255,0.9);
            box-shadow: 5px 5px 5px rgba(255,255,255,0.1);
            color: black;
        `
        if (onclick!==undefined)
            autoDOM.onclick = ()=> onclick(autoDOM)
        return autoDOM;
    }

    function createAutoButton() {
        let timer = undefined;
        let v = false;
        let cur_running = undefined;
        let autoBtn = createGlobalButton({
            text:"Auto: OFF",
            onclick: (autoDOM) => {
                if (cur_running!=undefined && cur_running!="auto") return;
                if (!v) {
                    cur_running = "auto";
                    autoDOM.innerText = "Auto: ON";
                    timer = setInterval(async () => {
                        let status = checkStatus();
                        console.log(`[${new Date().toLocaleString()}] check status: ${status}`);
                        if (status == "finished") {
                            sendText("继续");
                        } else if (status == "error") {
                            let [save,] = await editDialog(-2);
                            if (save!=null){
                                save.click();
                            }
                        }
                    }, 300);
                } else {
                    if (timer != undefined) {
                        clearInterval(timer);
                    }
                    autoDOM.innerText = "Auto: OFF";
                    cur_running = undefined;
                }
                v = !v;
            },
            index: 0
        })
        let saveBtn = createGlobalButton({
            text:"Download",
            onclick: async (_)=>{
                let dialogs = await getDialogDOMListText();
                let content = JSON.stringify(dialogs,null,2);
                let blob = new Blob([content],{type: 'text/plain'})
                let a = document.createElement('a');
                a.download = 'dialogs.json';
                a.href = URL.createObjectURL(blob);
                a.click();
                a.remove();
            },
            index: 1
        })
        let v2 = false;
        let timer2 = undefined;
        let count = 0;
        let regenerateBtn = createGlobalButton({
            text:"Rege: OFF",
            onclick: (autoDOM)=>{
                if (cur_running!=undefined && cur_running!="regenerate") return;
                if (!v2 && count<20) {
                    cur_running = "regenerate";
                    autoDOM.innerText = "Rege: ON";
                    timer2 = setInterval(async () => {
                        if (count>=20){
                            clearInterval(timer2);
                            autoDOM.click();
                            return;
                        }
                        let status = checkStatus();
                        console.log(`[${new Date().toLocaleString()}] check status: ${status}`);
                        if (status == "finished") {
                            let [re,,] = getDialogInputField()
                            if (re.innerText.indexOf("Regenerate")!=-1){
                                let btn = re.querySelector("button")
                                if (btn==undefined){
                                    ++count;
                                    re.click()
                                }else{
                                    ++count;
                                    btn.click()
                                }
                            }
                        } else if (status == "error") {
                            let [save,] = await editDialog(-2);
                            if (save!=null){
                                ++count;
                                save.click();
                            }
                        }
                    }, 300);
                } else {
                    if (timer2 != undefined) {
                        clearInterval(timer2);
                    }
                    count = 0;
                    autoDOM.innerText = "Rege: OFF";
                    cur_running = undefined;
                }
                v2 = !v2;
            },
            index: 2
        })
        document.body.appendChild(autoBtn);
        document.body.appendChild(saveBtn);
        document.body.appendChild(regenerateBtn)
    }
    console.log("[ChatGPTBot] version: 0.1");
    window.onload = () => {
        console.log("[ChatGPTBot] ready!");
        createAutoButton();
        // something to do
    }
})();