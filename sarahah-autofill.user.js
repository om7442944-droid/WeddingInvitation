// ==UserScript==
// @name         Sarahah Auto Fill
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Fill Sarahah message textarea from URL parameters (name, msg) to avoid manual copy/paste
// @author       GitHub Copilot
// @match        https://*.sarahah.pro/*
// @match        https://sarahah.pro/*
// @match        https://*.sarahah.com/*
// @grant        none
// ==/UserScript==

(function(){
    'use strict';
    function getParam(key){
        try{
            const u = new URL(window.location.href);
            return u.searchParams.get(key) || '';
        }catch(e){ return ''; }
    }
    const name = getParam('name');
    const msg = getParam('msg');
    if(!msg) return; // nothing to fill

    function findTextarea(){
        // common selectors
        const selectors = [
            'textarea[name="msg"]',
            'textarea#Msg',
            'textarea[id*="msg"]',
            'textarea'
        ];
        for(const s of selectors){
            const el = document.querySelector(s);
            if(el) return el;
        }
        // try XPath provided by user
        try{
            const xp = '/html/body/main/div[1]/div/div/div/div/div[3]/form/div[1]/div/div[1]/textarea';
            const r = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            if(r && r.singleNodeValue) return r.singleNodeValue;
        }catch(e){}
        return null;
    }

    function setValue(el, value){
        try{
            el.focus();
            el.value = value;
            // dispatch events so page notices change
            ['input','change'].forEach(name => el.dispatchEvent(new Event(name, { bubbles:true })));
            // place caret at end
            const len = el.value.length; el.setSelectionRange && el.setSelectionRange(len,len);
        }catch(e){ console.warn('autofill setValue', e); }
    }

    // wait for DOM ready and for possible dynamic loading
    const maxWait = 5000; const interval = 150; let waited = 0;
    const tId = setInterval(()=>{
        const ta = findTextarea();
        if(ta){
            const combined = name ? (name + '\n\n' + decodeURIComponent(msg)) : decodeURIComponent(msg);
            setValue(ta, combined);
            clearInterval(tId);
        }
        waited += interval; if(waited >= maxWait) clearInterval(tId);
    }, interval);
})();
