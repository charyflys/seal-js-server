import { MetaInfo, ScriptInfo } from "./manager";
import { BotConnection } from "../onebot/connect";
import { SealCmdArgs, SealMsg, SealMsgContext } from "../sealdiceContext";
import * as vm from 'vm';
import { CmdItemInfo, createSealModel, DefaultValue, SealExtInfo, TimeTask } from "./seal";

export class ExtControllor {
  connects: BotConnection[]
  extInfos: ScriptInfo[]
  nowExtParams: ScriptInfo | undefined
  exts: SealExtInfo[]
  seal: any
  vmContext: vm.Context
  CmdMap: Map<string, CmdItemInfo>
  timeoutCache: NodeJS.Timeout[]
  mounted: MountType[]
  master: number[]
  timeTasks: Map<string,TimeTask>
  constructor(
    connects: BotConnection[],
    extInfos: ScriptInfo[]
  ) {
    this.mounted = []
    this.exts = []
    this.extInfos = []
    this.seal = {}
    this.connects = connects
    this.extInfos = extInfos
    this.CmdMap = new Map()
    this.timeoutCache = []
    this.master = []
    this.timeTasks = new Map()
    this.vmContext = vm.createContext()
    this.nowExtParams = undefined
    this.init()
  }
  toJSON() {
    return {
      seal: this.seal,
      connects: this.connects,
      exts: this.exts,
      CmdMap: this.CmdMap,

    }
  }
  init() {
    this.seal = createSealModel(this)
    Object.freeze(this.seal)
    Object.freeze(this.seal.ext)
    this.setScripts()
    // setInterval(() => {
    //   this.timeTasks.forEach((v,key) => {
    //     if (v.fn) {
    //       if (v.taskType === 'daily') 
    //     }
    //   })
    // },60000)
    this.connects.forEach(v => {
      v.onMessage = (ctx: SealMsgContext, msg: SealMsg, args: SealCmdArgs) => this.onRegularCmd(ctx, msg, args, v)
      v.onNotCmd = (ctx: SealMsgContext, msg: SealMsg) => this.onNotCmd(ctx, msg, v)
      v.checkMaster = (qq) =>  this.master.includes(parseInt(qq.toString()))
    })
  }
  addConnection(connects: BotConnection[]) {
    connects.forEach(v => {
      v.onMessage = (ctx: SealMsgContext, msg: SealMsg, args: SealCmdArgs) => this.onRegularCmd(ctx, msg, args, v)
      v.onNotCmd = (ctx: SealMsgContext, msg: SealMsg) => this.onNotCmd(ctx, msg, v)
      v.checkMaster = (qq) =>  this.master.includes(parseInt(qq.toString()))
    })
    this.connects.push(...connects)
  }
  setScripts() {
    this.vmContext = vm.createContext({
      seal: this.seal,
      console: {
        log: console.log
      },
      setTimeout: (func: Function, delay: number) => {
        const number = setTimeout(() => { try { func() } catch (e:any) { console.log(e.stack) } }, delay)
        this.timeoutCache.push(number)
      },
      clearTimeout,
      fetch
    })
    this.exts = []
    this.mounted = []
    const mountExtNames:string[] = []
    const noRequire = this.extInfos.filter(v => !v.info.require&&!v.info.depends)
    let needRequire = this.extInfos.filter(v => v.info.require||v.info.depends)
    noRequire.forEach(v => {
      this.nowExtParams = v
      let mountType: MountType = { name: v.info.name,enable: true }
      try {
        console.log(`正在装载${v.info.name}-${v.info.author}-${v.info.version}`)
        JSRunContext(v,this.vmContext)
        mountExtNames.push(v.info.name)
      } catch (e: any) {
        console.log(e)
        let index = 0
        const str = String(e.stack).split('\n').filter((v, i) => {
          if (v.includes('runInContext') || index < i) {
            return false
          }
          index = i + 1
          return true
        }).join('\n')
        console.log(`[${v.info.name}] 指令执行错误${str}`)
        mountType.enable = false
        mountType.failMessage = str
        // const str = String(e.stack)
        // const res = str.match(/evalmachine.<anonymous>:(\d+):(\d+)/)
        // if (res)  
      } finally {
        this.mounted.push(mountType)
      }
    })
    let now = this.exts.length
    const needRequireInstalled: string[] = []
    while (true) {
      needRequire.forEach(v => {
        const depends = v.info.require||v.info.depends
        if (depends) {
          const arr = depends.split(':')
          if (arr.length !== 0 && arr[0]) {
            const result = mountExtNames.includes(arr[0])||mountExtNames.includes(arr[1])||(arr.length>2&&mountExtNames.includes(arr[2]))
            if (!result) {
              return
            }
          }
        }
        this.nowExtParams = v
        let mountType:MountType = { name:v.info.name,enable:true}
        try {
          console.log(`正在装载${v.info.name}-${v.info.author}-${v.info.version}`)
          JSRunContext(v,this.vmContext)
          needRequireInstalled.push(v.info.name)
          mountExtNames.push(v.info.name)
        } catch (e: any) {
          console.log(e)
          let index = 0
          const str = String(e.stack).split('\n').filter((v, i) => {
            if (v.includes('runInContext') || index < i) {
              return false
            }
            index = i + 1
            return true
          }).join('\n')
          console.log(`[${v.info.name}] 指令执行错误${str}`)
          mountType.enable = false
          mountType.failMessage = str
        }finally{
          this.mounted.push(mountType)
        }
      })
      needRequire = needRequire.filter(v => !needRequireInstalled.includes(v.info.name))
      if (now !== this.exts.length) {
        now = this.exts.length
      } else {
        break
      }
    }
    const mountSuccess = this.mounted.filter(v => v.enable)
    this.mounted.forEach(v =>(!mountSuccess.find(m=>v.name===m.name))&&mountSuccess.push(v))
    this.mounted = mountSuccess
    this.exts.forEach(v => {
      for (const key in v.cmdMap) {
        if (!this.CmdMap.has(key)) {
          this.CmdMap.set(key, v.cmdMap[key] as CmdItemInfo)
        } else {
          console.log((v.cmdMap[key] as CmdItemInfo).name + "装载失败，存在同名指令" + this.CmdMap.get(key))
        }
      }
    })
    console.log('已加载以下指令: \n' + Array.from(this.CmdMap.keys()).join(' | '))
  }
  async onRegularCmd(ctx: SealMsgContext, msg: SealMsg, args: SealCmdArgs, connect: BotConnection) {
    const cmd = this.CmdMap.get(args.command)
    if (cmd) {
      console.log(`${msg.message} 触发 ${cmd.name}`)
      if (!cmd.allowDelegate) args.at = []
      try {
        const res = await (cmd.solve && cmd.solve(ctx, msg, args))
        if (res&&res.showHelp === true) {
          connect.sendMsg({
            user_id: msg.sender.userId,
            group_id: ctx.group ? ctx.group.groupId : undefined,
            message: cmd.help
          })
        }
      } catch (e: any) {
        let index = 0
        const str = String(e.stack).split('\n').filter((v, i) => {
          if (v.includes('onRegularCmd') || index < i) {
            return false
          }
          index = i + 1
          return true
        }).join('\n')
        console.log(`[${cmd.name}] 指令执行错误${str}`)
        // console.log(e)
        connect.sendMsg({
          user_id: msg.sender.userId,
          group_id: ctx.group ? ctx.group.groupId : undefined,
          message: `[${cmd.name}] 指令执行错误！${e} ${str})`
        })
      }
    } else {
      console.log('没有对应的指令' + cmd)
    }
  }
  onNotCmd(ctx: SealMsgContext,msg:SealMsg, connect: BotConnection) {
    this.exts.forEach(ext =>{
      if (ext.onNotCommandReceived) {
        try {
          ext.onNotCommandReceived(ctx,msg)
        } catch(e:any) {
          let index = 0
          const str = String(e.stack).split('\n').filter((v, i) => {
            if (v.includes('onNotCmd') || index < i) {
              return false
            }
            index = i + 1
            return true
          }).join('\n')
          console.log(`[${ext.name}] 指令执行错误${str}`)
          // console.log(e)
          connect.sendMsg({
            user_id: msg.sender.userId,
            group_id: ctx.group ? ctx.group.groupId : undefined,
            message: `[${ext.name}] 指令执行错误！${e} ${str})`
          })
        }
      }
    })
  }
  reMount(newScripts: ScriptInfo[]) {
    console.log(newScripts.length)
    this.clearTimeout()
    this.CmdMap.clear()
    this.exts = []
    this.extInfos = []
    this.extInfos = newScripts
    this.setScripts()
    this.timeTasks.clear()
  }
  clearTimeout() {
    const arr = this.timeoutCache.splice(0, this.timeoutCache.length)
    arr.forEach(v => clearTimeout(v))
  }
}

type MountType = {
  name: string
  enable: boolean
  failMessage?: string
}



function JSRunContext(sInfo:ScriptInfo,context: vm.Context) {
  return new vm.Script(JSTemplate(sInfo.script),{filename: sInfo.info.name}).runInContext(context)
}

function JSTemplate(content: string) {
  return `(function(globalThis){${content}
  }).apply((new Proxy({},{get(target, prop, receiver) {if (prop in target) {return Reflect.get(this, prop, receiver);}return Reflect.get(target, prop, receiver);}})),[this])`
}
// (new Proxy({},{get(target, prop, receiver) {if (prop in target) {return Reflect.get(this, prop, receiver);}return Reflect.get(target, prop, receiver);}})),[this]



