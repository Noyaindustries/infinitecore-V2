function i(o){if(!o)return"";const t=1024,a=["o","Ko","Mo","Go"],r=Math.floor(Math.log(o)/Math.log(t));return`${parseFloat((o/t**r).toFixed(1))} ${a[r]}`}export{i as f};
