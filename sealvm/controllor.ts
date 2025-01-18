import { MetaInfo, ScriptInfo } from "./manager";
import { BotConnection } from "../onebot/connect";
import { SealCmdArgs, SealMsg, SealMsgContext } from "../sealdiceContext";
import vm from 'vm';

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

function createSealModel(_this: ExtControllor) {
  return {
    ext: {
      new(name: string, author: string, version: string) {
        if (_this.nowExtParams) {
          const ext = new SealExtInfo(name, author, version, _this.nowExtParams.storage,_this.nowExtParams.config)
          _this.exts.push(ext)
          return ext
        } else {
          throw Error('异常的没有找到对应的存储位置')
        }
      },
      newCmdExecuteResult(success: boolean) {
        return {
          solved: success,
          showHelp: false
        }
      },
      register(ext: SealExtInfo) {
        //TODO
      },
      find(name: string) {
        return _this.exts.find(v => v.name === name)
      },
      newCmdItemInfo() {
        return {
          solve: null,
          name: '',
          help: '',
          allowDelegate: false,
          disabledInPrivate: false,
        }
      },

      registerStringConfig(ext: SealExtInfo, key: string, defaultValue: string, desc?: string) {
        return ext._registerRegularConfig(key,defaultValue,desc)
      },
      
      registerIntConfig(ext: SealExtInfo, key: string, defaultValue: string, desc?: string) {
        return ext._registerRegularConfig(key,defaultValue,desc)
      },
      
      registerBoolConfig(ext: SealExtInfo, key: string, defaultValue: string, desc?: string) {
        return ext._registerRegularConfig(key,defaultValue,desc)
      },
      
      registerFloatConfig(ext: SealExtInfo, key: string, defaultValue: string, desc?: string) {
        return ext._registerRegularConfig(key,defaultValue,desc)
      },
      
      registerTemplateConfig(ext: SealExtInfo, key: string, defaultValue: string, desc?: string) {
        return ext._registerRegularConfig(key,defaultValue,desc)
      },
      
      registerOptionConfig(ext: SealExtInfo, key: string, defaultValue: string,option: string[], desc?: string) {
        return ext._registerOptionsConfig(key,defaultValue,option,desc)
      },

      getStringConfig(ext: SealExtInfo,key: string){
        return ext._getRegularConfig(key)
      },

      getIntConfig(ext: SealExtInfo,key: string){
        return ext._getRegularConfig(key)
      },

      getBoolConfig(ext: SealExtInfo,key: string){
        return ext._getRegularConfig(key)
      },

      getFloatConfig(ext: SealExtInfo,key: string){
        return ext._getRegularConfig(key)
      },

      getTemplateConfig(ext: SealExtInfo,key: string){
        return ext._getRegularConfig(key)
      },

      getOptionConfig(ext: SealExtInfo,key: string){
        return ext._getOptionsConfig(key)
      },

  
    },


    replyToSender(ctx: SealMsgContext, msg: SealMsg, text: string) {
      const endPointId = ctx.endPoint.userId
      const endPointConnect = _this.connects.find(v => v.checkEndPoint(endPointId))
      if (endPointConnect) {
        console.log(`触发回复 ${endPointId}=>${msg.groupId || (ctx.group ? ctx.group.groupId : '')} ${msg.sender.userId} 回复:${text}`)
        endPointConnect.sendMsg({
          user_id: msg.sender.userId,
          group_id: msg.groupId || (ctx.group ? ctx.group.groupId : undefined),
          message: text
        })
      }
    },
    replyPerson(ctx: SealMsgContext, msg: SealMsg, text: string) {
      const endPointId = ctx.endPoint.userId
      const endPointConnect = _this.connects.find(v => v.checkEndPoint(endPointId))
      console.log(`触发回复 =>${msg.groupId || (ctx.group ? ctx.group.groupId : '')} ${msg.sender.userId} 回复:${text}`)
      if (endPointConnect && (!ctx.group)) {
        endPointConnect.sendMsgPri({
          user_id: msg.sender.userId,
          message: text
        })
      }
    },
    replyGroup(ctx: SealMsgContext, msg: SealMsg, text: string) {
      const endPointId = ctx.endPoint.userId
      const endPointConnect = _this.connects.find(v => v.checkEndPoint(endPointId))
      console.log(`触发回复 =>${msg.groupId || (ctx.group ? ctx.group.groupId : '')} ${msg.sender.userId} 回复:${text}`)
      if (endPointConnect && (ctx.group)) {
        endPointConnect.sendMsgGroup({
          user_id: msg.sender.userId,
          group_id: ctx.group.groupId,
          message: text
        })
      }
    },
    getCtxProxyFirst(ctx: SealMsgContext, msg: SealMsg,) {
      // TODO
      return ctx
    },
    getEndPoints() {
      return _this.connects.map(v => ({ userId: v.getEndPoint() }))
    },
    newMessage(): SealMsg {
      return {
        guildId: '',
        groupId: '',
        sender: {
          userId: '',
          nickname: ''
        },
        platform: 'QQ',
        message: '',
        time: Math.floor(Date.now() / 1000),
        messageType: 'private',
        rawId: ''
      }
    },
    createTempCtx(ep: { userId: string }, msg: SealMsg): SealMsgContext {
      return {
        endPoint: ep,
        player: {
          name: msg.sender.nickname,
          userId: msg.sender.userId,
          lastCommandTime: 0,
          autoSetNameTemplate: ""
        },
        isPrivate: true,
        isCurGroupBotOn: true,
        privilegeLevel: 0,
        delegateText: ''
      }
    },
    registerTask(ext: SealExtInfo, taskType: TimeOutTaskType, value: string, fn: Function, key?: string, desc?: string) {

    }

  }
}
type TimeOutTaskType = 'cron'|'daily'
type TimeTask = {
  taskType: TimeOutTaskType
  value: string
  fn: Function
  ext: SealExtInfo
  key: string
  desc: string
}
function JSRunContext(sInfo:ScriptInfo,context: vm.Context) {
  return new vm.Script(JSTemplate(sInfo.script),{filename: sInfo.info.name}).runInContext(context)
}

function JSTemplate(content: string) {
  return `(function(globalThis){${content}
  }).apply((new Proxy({},{get(target, prop, receiver) {if (prop in target) {return Reflect.get(this, prop, receiver);}return Reflect.get(target, prop, receiver);}})),[this])`
}
// (new Proxy({},{get(target, prop, receiver) {if (prop in target) {return Reflect.get(this, prop, receiver);}return Reflect.get(target, prop, receiver);}})),[this]
class SealExtInfo {
  // name: string;
  // version: string;
  // author: string;
  cmdMap: { [key: string]: CmdItemInfo|null; };
  isLoaded: boolean;
  constructor(
    public name: string,
    public author: string,
    public version: string,
    private _store: Map<string, string>,
    private _config: Map<string, any>,
  ) {
    this.isLoaded = false
    this.cmdMap = {}
    this.onNotCommandReceived = undefined
  }
  storageSet(key: string, value: string) {
    if (typeof value !== 'string') throw new Error('错误的使用了非string类型进行存储')
    return this._store.set(key, value)
  }
  storageGet(key: string): string {
    return this._store.get(key) || ''
  }
  onNotCommandReceived?: (((ctx: SealMsgContext, msg: SealMsg) => void))|null;
  // 用于一些常规类型的注册，如int,bool,float,string
  _registerRegularConfig(key:string,defaultValue: DefaultValue, desc?: string) {
    this._config.set(key,{
      defaultValue,
      value: defaultValue,
      desc,
    })
  }
    // 用于一些常规类型配置的获取，如int,bool,float,string
  _getRegularConfig(key:string) {
    const configItem = this._config.get(key) as { defaultValue:DefaultValue,value:DefaultValue,desc?: string }
    return configItem ? configItem.value : undefined
  }

  _registerOptionsConfig(key:string,defaultValue: string,option: string[], desc?: string) {
    this._config.set('option_'+key,{
      defaultValue,
      value: defaultValue,
      option,
      desc})
  }
    // 用于一些常规类型配置的获取，如int,bool,float,string
  _getOptionsConfig(key:string) {
    const configItem = this._config.get('option_'+key) as { defaultValue:string,value:string,option:string[],desc?: string }
    return configItem ? configItem.value : undefined
  }

  _destroy() {
    for(const key in this.cmdMap) {
      const mapItem = this.cmdMap[key]
      if (mapItem!==null) {
        mapItem.solve = null
      }
      this.cmdMap[key] = null
      this.onNotCommandReceived = null
    }
  }
  
  // onCommandReceived: (ctx: SealMsgContext, msg: SealMsg, cmdArgs: SealCmdArgs) => void;
  // onMessageReceived: (ctx: SealMsgContext, msg: SealMsg) => void;
  // onMessageSend: (ctx: SealMsgContext, msg: SealMsg) => void;
  // getDescText(): string {
  //   throw new Error("Method not implemented.");
  // }
  // onLoad: (...any: any) => void;
  // storageInit() {
  //   throw new Error("Method not implemented.");
  // }
  // storageGetRaw(k: string) {
  //   return ''
  // }
  // storageSetRaw(k: string, v: string) {
  //   throw new Error("Method not implemented.");
  // }

}

type DefaultValue = number|string|string[]

interface ExtInfo {
  /** 名字 */
  name: string;
  /** 版本 */
  version: string;
  /** 名字 */
  author: string;
  /** 指令映射 */
  cmdMap: { [key: string]: CmdItemInfo };
  /** 是否加载完成 */
  isLoaded: boolean
  /** 存放数据 */
  storageSet(key: string, value: string): void;
  /** 取数据 */
  storageGet(key: string): string;
  /** 匹配非指令消息 */
  onNotCommandReceived?: (ctx: SealMsgContext, msg: SealMsg) => void
  // /** 试图匹配自定义指令（只对内置扩展有意义） */ // 已废弃
  // // onCommandOverride: (ctx: MsgContext, msg: Message, cmdArgs: CmdArgs) => boolean;
  // /** 监听 收到指令 事件 */
  // onCommandReceived: (ctx: SealMsgContext, msg: SealMsg, cmdArgs: SealCmdArgs) => void
  // /** 监听 收到消息 事件，如 log 模块记录收到文本 */
  // onMessageReceived: (ctx: SealMsgContext, msg: SealMsg) => void
  // /** 监听 发送消息 事件，如 log 模块记录指令文本 */
  // onMessageSend: (ctx: SealMsgContext, msg: SealMsg) => void
  // /** 获取扩展介绍文本 */
  // getDescText(): string
  // /** 监听 加载时 事件，如 deck 模块需要读取牌堆文件 */
  // onLoad: (...any: any) => void
  // /** 初始化数据，读写数据时会自动调用 */
  // storageInit():void
  // /** 读数据 如果无需自定义错误处理就无需使用 */
  // storageGetRaw(k: string):string
  // /** 写数据 如果无需自定义错误处理就无需使用 */
  // storageSetRaw(k: string, v: string):void
}
interface CmdItemInfo {
  solve: ((ctx: SealMsgContext, msg: SealMsg, cmdArgs: SealCmdArgs) => SealCmdRes)|null;

  /** 指令名称 */
  name: string;
  /** 长帮助，带换行的较详细说明  */
  help: string;
  /** 允许代骰 */
  allowDelegate: boolean;
  /** 私聊不可用 */
  disabledInPrivate: boolean;
}

interface SealCmdRes {
  /** 是否顺利完成执行 */
  solved: boolean;
  /** 是否返回帮助信息 */
  showHelp: boolean;
}