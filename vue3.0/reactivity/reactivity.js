//用proxy 监听一个对象
//obj.name 收集依赖  obj.name = xx 触发set方法，执行收集到的effect回调
//用map来收集所有的依赖,weakMap方式，map套key套回调
// {
//     target:{
//         key:[effect1,effect2]
//     }
// }
// 
// {
//     {
//         name:'senlyn',
//         age:1
//     }:{
//         name:[()=>{}],
//         age:[effect]
//     }

const { triggerRef } = require("vue");

// }
const targetMap = new WeakMap();//防止内存泄漏，全局map
const effectArr = [];
//收集依赖
function track(target,key){
    const effect = effectArr[effectArr.length - 1];
    if(effect){
        //需要收集的情况
        let depMap = targetMap.get(target);
        if(depMap === undefined){
            depMap = new Map();
            targetMap.set(target,depMap);
        }
        let dep = depMap.get(key);
        if(dep === undefined){
            dep = new set();//防止重复
            depMap.set(key,dep);
        }
        if(!dep.has(effect)){
            dep.add(effect)//上面所有的代码都是为了这一行
            effect.deps.push(dep);//双向缓存 vue2中缓存状态的cache工具方法
        }
    }
}
function trigger(target, key, info){
    let depMap = targetMap.get(target)
    if(depMap===undefined){
        return // 没有effect副作用
    }
    const effects = new Set()
    const computeds = new Set() // computed是一个特殊的effect

    if(key){
        let deps = depMap.get(key)
        deps.forEach(effect=>{
            if(effect.computed){
                computeds.add(effect)
            }else{
                effects.add(effect)
            }
        })
    }
    effects.forEach(effect=>effect())
    computeds.forEach(computed=>computed())

}
const baseHandler = {
    //get 和 set ,还有删除，是不是存在
    get(target,key){
        const ret = target[key];//实际中用的是Reflect.get(target,key) 
        track(target,key);
        // 在这里需要收集依赖到全局map

        return typeof ret === 'object' ? reactive(ret) : ret;
    },
    set(target,key,val){
        const info = {oldVal = target[key],newVal:val};
        // 在这里执行一下收集到的effect
        target[key] = val;
        trigger(target,key,info);

    }

}
function reactive(){
    const observed = new Proxy(target,baseHandler);
    return observed;
}
// 便于维护，便于测试
function effect(fn,options={}){
    // 只考虑执行的逻辑，
    let e = createReactiveEffect(fn,options)
    if(!options.lazy){
        e()
    }
    return e
}
function createReactiveEffect(fn,options){
    //effect扩展配置
    const effect = function effect(...args){
        return run(effect, fn, args)
    }
    effect.deps = []
    effect.computed = options.computed
    effect.lazy = options.lazy
    return effect
}
// 调度，
function run(effect, fn, args){
    // 执行
    if(effectStack.indexOf(effect)===-1){
        try{
            effectStack.push(effect)
            return fn(...args)
        }finally{
            effectStack.pop()
        }
    }
}
function computed(fn){
    const runner = effect(fn, {computed:true, lazy:true})
    return {
        effect:runner,
        get value(){
            return runner()
        }
    }
}