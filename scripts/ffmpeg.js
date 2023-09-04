!function(e,t){"object"==typeof exports&&"object"==typeof module?module.exports=t():"function"==typeof define&&define.amd?define([],t):"object"==typeof exports?exports.FFmpegWASM=t():e.FFmpegWASM=t()}(self,(()=>(()=>{"use strict";var e={m:{},d:(t,s)=>{for(var r in s)e.o(s,r)&&!e.o(t,r)&&Object.defineProperty(t,r,{enumerable:!0,get:s[r]})},u:e=>e+".ffmpeg.js"};e.g=function(){if("object"==typeof globalThis)return globalThis;try{return this||new Function("return this")()}catch(e){if("object"==typeof window)return window}}(),e.o=(e,t)=>Object.prototype.hasOwnProperty.call(e,t),e.r=e=>{"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},(()=>{var t;e.g.importScripts&&(t=e.g.location+"");var s=e.g.document;if(!t&&s&&(s.currentScript&&(t=s.currentScript.src),!t)){var r=s.getElementsByTagName("script");if(r.length)for(var a=r.length-1;a>-1&&!t;)t=r[a--].src}if(!t)throw new Error("Automatic publicPath is not supported in this browser");t=t.replace(/#.*$/,"").replace(/\?.*$/,"").replace(/\/[^\/]+$/,"/"),e.p=t})(),e.b=document.baseURI||self.location.href;var t,s={};e.r(s),e.d(s,{FFmpeg:()=>i}),function(e){e.LOAD="LOAD",e.EXEC="EXEC",e.WRITE_FILE="WRITE_FILE",e.READ_FILE="READ_FILE",e.DELETE_FILE="DELETE_FILE",e.RENAME="RENAME",e.CREATE_DIR="CREATE_DIR",e.LIST_DIR="LIST_DIR",e.DELETE_DIR="DELETE_DIR",e.MOUNT="MOUNT",e.ERROR="ERROR",e.DOWNLOAD="DOWNLOAD",e.PROGRESS="PROGRESS",e.LOG="LOG"}(t||(t={}));const r=(()=>{let e=0;return()=>e++})(),a=(new Error("unknown message type"),new Error("ffmpeg is not loaded, call `await ffmpeg.load()` first")),o=new Error("called FFmpeg.terminate()");new Error("failed to import ffmpeg-core.js");class i{#e=null;#t={};#s={};#r=[];#a=[];loaded=!1;#o=()=>{this.#e&&(this.#e.onmessage=({data:{id:e,type:s,data:r}})=>{switch(s){case t.LOAD:this.loaded=!0,this.#t[e](r);break;case t.EXEC:case t.WRITE_FILE:case t.READ_FILE:case t.DELETE_FILE:case t.RENAME:case t.CREATE_DIR:case t.LIST_DIR:case t.DELETE_DIR:case t.MOUNT:this.#t[e](r);break;case t.LOG:this.#r.forEach((e=>e(r)));break;case t.PROGRESS:this.#a.forEach((e=>e(r)));break;case t.ERROR:this.#s[e](r)}delete this.#t[e],delete this.#s[e]})};#i=({type:e,data:t},s=[])=>this.#e?new Promise(((a,o)=>{const i=r();this.#e&&this.#e.postMessage({id:i,type:e,data:t},s),this.#t[i]=a,this.#s[i]=o})):Promise.reject(a);on(e,t){"log"===e?this.#r.push(t):"progress"===e&&this.#a.push(t)}off(e,t){"log"===e?this.#r=this.#r.filter((e=>e!==t)):"progress"===e&&(this.#a=this.#a.filter((e=>e!==t)))}load=(s={})=>(this.#e||(this.#e=new Worker(new URL(e.p+e.u(814),e.b),{type:void 0}),this.#o()),this.#i({type:t.LOAD,data:s}));exec=(e,s=-1)=>this.#i({type:t.EXEC,data:{args:e,timeout:s}});terminate=()=>{const e=Object.keys(this.#s);for(const t of e)this.#s[t](o),delete this.#s[t],delete this.#t[t];this.#e&&(this.#e.terminate(),this.#e=null,this.loaded=!1)};writeFile=(e,s)=>{const r=[];return s instanceof Uint8Array&&r.push(s.buffer),this.#i({type:t.WRITE_FILE,data:{path:e,data:s}},r)};readFile=(e,s="binary")=>this.#i({type:t.READ_FILE,data:{path:e,encoding:s}});deleteFile=e=>this.#i({type:t.DELETE_FILE,data:{path:e}});rename=(e,s)=>this.#i({type:t.RENAME,data:{oldPath:e,newPath:s}});createDir=e=>this.#i({type:t.CREATE_DIR,data:{path:e}});listDir=e=>this.#i({type:t.LIST_DIR,data:{path:e}});deleteDir=e=>this.#i({type:t.DELETE_DIR,data:{path:e}});mount=(e,s,r)=>this.#i({type:t.MOUNT,data:{type:e,opts:s,mountpoint:r}})}return s})()));