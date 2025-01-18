import { SealMsgContext, SealMsg, SealCmdArgs } from "../sealdiceContext"
import { ExtControllor } from "./controllor"
import {dc} from '../dicevm'
const c = dc.newVMForPlaygournd()
c.SetConfig({
    OpCountLimit: 30000,
    PrintBytecode: true,
    EnableDiceWoD: true,
    EnableDiceCoC: true,
    EnableDiceFate: true,
    EnableDiceDoubleCross: true,
})
console.log(c)
export function createSealModel(_this: ExtControllor) {
    return {
        ext: {
            new(name: string, author: string, version: string) {
                if (_this.nowExtParams) {
                    const ext = new SealExtInfo(name, author, version, _this.nowExtParams.storage, _this.nowExtParams.config)
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
                return ext._registerRegularConfig(key, defaultValue, desc)
            },

            registerIntConfig(ext: SealExtInfo, key: string, defaultValue: string, desc?: string) {
                return ext._registerRegularConfig(key, defaultValue, desc)
            },

            registerBoolConfig(ext: SealExtInfo, key: string, defaultValue: string, desc?: string) {
                return ext._registerRegularConfig(key, defaultValue, desc)
            },

            registerFloatConfig(ext: SealExtInfo, key: string, defaultValue: string, desc?: string) {
                return ext._registerRegularConfig(key, defaultValue, desc)
            },

            registerTemplateConfig(ext: SealExtInfo, key: string, defaultValue: string, desc?: string) {
                return ext._registerRegularConfig(key, defaultValue, desc)
            },

            registerOptionConfig(ext: SealExtInfo, key: string, defaultValue: string, option: string[], desc?: string) {
                return ext._registerOptionsConfig(key, defaultValue, option, desc)
            },

            getStringConfig(ext: SealExtInfo, key: string) {
                return ext._getRegularConfig(key)
            },

            getIntConfig(ext: SealExtInfo, key: string) {
                return ext._getRegularConfig(key)
            },

            getBoolConfig(ext: SealExtInfo, key: string) {
                return ext._getRegularConfig(key)
            },

            getFloatConfig(ext: SealExtInfo, key: string) {
                return ext._getRegularConfig(key)
            },

            getTemplateConfig(ext: SealExtInfo, key: string) {
                return ext._getRegularConfig(key)
            },

            getOptionConfig(ext: SealExtInfo, key: string) {
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
        getCtxProxyFirst(ctx: SealMsgContext, cmdArgs: SealCmdArgs,) {
            // TODO
            const pctx = JSON.parse(JSON.stringify(ctx)) as SealMsgContext
            const endPoint = _this.connects.find(v => {
                return v.checkEndPoint(ctx.endPoint.userId)
            })
            if (!endPoint)return ctx
            if (!cmdArgs.at[0]) return ctx
            const proxyOne = endPoint.getPlayerInfo(cmdArgs.at[0].userId)
            pctx.player.userId = cmdArgs.at[0].userId
            pctx.player.name = proxyOne?proxyOne.nickname : '';
            return pctx
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

        },
        format(ctx:SealExtInfo,text: string) {
            const arr = extractNestedContent(text).map(v => {
                let s = v.s
                if (!v.t) {
                    if (v.s.startsWith('%')&&v.s.endsWith('%')) {
                        s = v.s.substring(1,s.length-1)
                    }
                    console.log('?',s.trim())
                    c.Run(s.trim())
                    if (c.Error) {
                        return c.GetErrorText()
                    }
                    return c.Ret.ToString()
                }
                return s
            })
            return arr.join('')
        }
    }
}


export class SealExtInfo {
    // name: string;
    // version: string;
    // author: string;
    cmdMap: { [key: string]: CmdItemInfo | null; };
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
    onNotCommandReceived?: (((ctx: SealMsgContext, msg: SealMsg) => void)) | null;
    // 用于一些常规类型的注册，如int,bool,float,string
    _registerRegularConfig(key: string, defaultValue: DefaultValue, desc?: string) {
        this._config.set(key, {
            defaultValue,
            value: defaultValue,
            desc,
        })
    }
    // 用于一些常规类型配置的获取，如int,bool,float,string
    _getRegularConfig(key: string) {
        const configItem = this._config.get(key) as { defaultValue: DefaultValue, value: DefaultValue, desc?: string }
        return configItem ? configItem.value : undefined
    }

    _registerOptionsConfig(key: string, defaultValue: string, option: string[], desc?: string) {
        this._config.set('option_' + key, {
            defaultValue,
            value: defaultValue,
            option,
            desc
        })
    }
    // 用于一些常规类型配置的获取，如int,bool,float,string
    _getOptionsConfig(key: string) {
        const configItem = this._config.get('option_' + key) as { defaultValue: string, value: string, option: string[], desc?: string }
        return configItem ? configItem.value : undefined
    }

    _destroy() {
        for (const key in this.cmdMap) {
            const mapItem = this.cmdMap[key]
            if (mapItem !== null) {
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

function extractNestedContent(text:string):{s:string,t:boolean}[] {
    let result = [];
    let stack = [];
    let currentContent = '';
    let inBraces = false;
    let last = 0
    for (let i = 0; i < text.length; i++) {
        let char = text[i];

        if (char === '{') {
            if (inBraces) {
                // 嵌套的情况，直接加入栈中
                stack.push(currentContent);
                currentContent = '';
            }else {
                result.push({s: text.substring(last,i), t: true})
            }
            inBraces = true;
        } else if (char === '}') {
            if (inBraces) {
                if (stack.length === 0) {
                    result.push({s:currentContent, t: false}); // 提取出完整的内容
                    currentContent = '';
                    inBraces = false;
                    last = i+1;
                } else {
                    currentContent = stack.pop() + '{' + currentContent + '}'; // 处理嵌套
                }
            }
        } else {
            if (inBraces) {
                currentContent += char;
            }
        }
    }
    result.push({s: text.substring(last,text.length), t: true})
    return result;
}



type TimeOutTaskType = 'cron' | 'daily'
export type TimeTask = {
    taskType: TimeOutTaskType
    value: string
    fn: Function
    ext: SealExtInfo
    key: string
    desc: string
}

export interface CmdItemInfo {
    solve: ((ctx: SealMsgContext, msg: SealMsg, cmdArgs: SealCmdArgs) => SealCmdRes) | null;

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

export type DefaultValue = number | string | string[]

