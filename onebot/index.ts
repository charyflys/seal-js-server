import ws,{WebSocket} from 'ws'
import { BotConnection } from './connect'
import { PriMsgContent, GroupMsgContent, AtMsg, TextMsg } from '../msg'
import { NoticeContent, ReqContent, MetaContent } from '../recivebase'
import { SealCmdArgs, SealMsg, SealMsgContext } from '../sealdiceContext'

const qqCache = new Map<number,PersonInfo>()
const groupCache = new Map<number,GroupInfo>()
const grouproleCache = new Map<string,PersonInGroup>()
const errorDelay = 5000
const roleLvMap ={
    'owner': 60,
    'admin': 50,
    'member': 0
}
async function getSealArgs(sender: OneBotMsgSender,context:PriMsgContent | GroupMsgContent):Promise<[SealMsgContext,SealMsg]|[SealMsgContext,SealMsg,SealCmdArgs]> {
    let ctx: SealMsgContext,msg: SealMsg,args: SealCmdArgs
    const userId = 'QQ:'+context.user_id
    const nickname = (await sender.getPersonInfo(context.user_id)).nickname

    msg = {
        time: context.time,
        messageType: 'private',
        guildId: '',
        sender: {
            nickname,
            userId,
        },
        message: context.raw_message,
        rawId: '',
        platform: 'QQ',
    }
    ctx = {
        endPoint: {
            userId: 'QQ:'+context.self_id,
            nickname: (await sender.getPersonInfo(context.user_id)).nickname
        },
        player: {
            name: nickname,
            userId,
            lastCommandTime: 0,
            autoSetNameTemplate: ''
        },
        isCurGroupBotOn: true,
        isPrivate: true,
        privilegeLevel: (sender.checkMaster&&sender.checkMaster(context.user_id)) ? 100 : 0,
        delegateText: '',
    }
    if (context.message_type === 'group') {
        const groupId = 'QQ-Group:'+ context.group_id
        const role = await sender.getRoleInGroup(context.group_id,context.user_id)
        ctx.privilegeLevel = ctx.privilegeLevel===100 ? ctx.privilegeLevel: roleLvMap[role.role]
        ctx.group = {
            active: true,
            groupId,
            groupName: (await sender.getGroupInfo(context.group_id)).group_name,
            recentCommandTime: 0
        }
        msg.messageType = 'group'
        msg.groupId = groupId
    }
    const checkText = (context.message.filter(v => v.type==='text') as TextMsg[]).map((v:TextMsg) => v.data.text).join('').trim()
    const match = (checkText.match(/^(\.|。)\S+(\s|\n)*/) as RegExpMatchArray)
    if ((checkText.startsWith('.')||checkText.startsWith('。'))&&match) {
        const cmd = match[0].trim()
        const text = checkText.replace(cmd,'').trim()
        const cmdargs = text.replaceAll('\n',' ').split(/ +/)
        // const ats = context.message.filter(v => v.type==='at').map(v => ({userId:v.data.qq}))
        args = {
            command: cmd.substring(1),
            args: cmdargs,
            at: (context.message.filter(v => v.type==='at') as AtMsg[]).map((v:AtMsg) => ({userId:'QQ:'+v.data.qq})),
            rawArgs: text,
            amIBeMentioned: context.message.findIndex(v => v.type==='at'&&v.data.qq===context.self_id.toString()) !== -1,
            amIBeMentionedFirst: (context.message.filter(v => v.type==='at') as AtMsg[]).map(v => v.data.qq).join('')===context.self_id.toString(),
            cleanArgs: cmdargs.join(' ')
        }
        args = new CmdArgs(
            cmd.substring(1),
            cmdargs,
            (context.message.filter(v => v.type==='at') as AtMsg[]).map((v:AtMsg) => ({userId:'QQ:'+v.data.qq})),
            text,
            context.message.findIndex(v => v.type==='at'&&v.data.qq===context.self_id.toString()) !== -1,
            (context.message.filter(v => v.type==='at') as AtMsg[]).map(v => v.data.qq).join('')===context.self_id.toString(),
            cmdargs.join(' ')
        )
        return [ctx,msg,args]
    }
    return [ctx,msg]
}
class OneBotMsgSender implements BotConnection{
    self: number
    ws: WebSocket
    public onMessage: null| ((ctx: SealMsgContext,msg: SealMsg,args: SealCmdArgs) => void)
    public onNotCmd: null| ((ctx: SealMsgContext,msg: SealMsg) => void)
    public checkMaster: ((qq: number|string) => boolean) | null
    event: Map<string,Function[]>
    constructor(ws: WebSocket,self = 0) {
        this.ws = ws
        this.self = self
        const _this = this
        this.event = new Map()
        this.onMessage = null
        this.onNotCmd = null
        this.checkMaster = null
        if (this.ws.readyState === this.ws.OPEN) {
            this.ws.send(JSON.stringify({
                action: "get_login_info"
            }))
        } else {
            this.ws.on('open',() => {
                this.ws.send(JSON.stringify({
                    action: "get_login_info"
                }))
            })
        }
        this.ws.on('message',async function(data,isBanriy) {
            if (!isBanriy) {
                const context = JSON.parse(data.toString()) as PriMsgContent|GroupMsgContent|NoticeContent|ReqContent|MetaContent|ReturnType<GroupInfo|PersonInfo|PersonInGroup>
                if ('data'in context) {
                    if (context.data) {
                        if ('group_name' in context.data) {
                            const arr = _this.event.get(`group_info_${context.data.group_id}`)
                            if (arr) {
                                arr.splice(0,arr.length).forEach(v => {
                                    v(context.data)
                                })
                            }
                        } else if ('role' in context.data&&'group_id'in context.data) {
                            const key = `group_role_${context.data.group_id}_${context.data.user_id}`
                            const arr = _this.event.get(key)
                            if (arr) {
                                // console.log(context.data)
                                arr.splice(0,arr.length).forEach(v => {
                                    v(context.data)
                                })
                            }
                        } else if ('nickname' in context.data) {
                            const arr = _this.event.get(`person_info_${context.data.user_id}`)
                            if (arr) {
                                arr.splice(0,arr.length).forEach(v => {
                                    v(context.data)
                                })
                            } else {
                                _this.self = context.data.user_id
                            }
                        } 
                    }
                } else if (context.post_type ==='message') {
                    _this.self = context.self_id
                    const args = await getSealArgs(_this,context)
                    if (args.length === 3)
                    _this.onMessage&&_this.onMessage(...args)
                    else 
                    _this.onNotCmd&&_this.onNotCmd(...args)
                }
            }
        })
    }
    checkEndPoint(user_id: string) {
        return user_id.replace(this.self.toString(),'') === 'QQ:'
    }
    getEndPoint() {
        return `QQ:${this.self}`
    }
    sendMsgPri ({ user_id, message }: { user_id: string; message: string }):void {
        if (this.ws.readyState===this.ws.OPEN) {
            this.ws.send(JSON.stringify({
                action: 'send_private_msg',
                params: {
                    user_id: parseInt(user_id.replace('QQ:','')),
                    message
                }
            }))
        }
    }
    sendMsgGroup ({ user_id, group_id, message }: { user_id?: string; group_id: string; message: string }):void {
        if (this.ws.readyState===this.ws.OPEN) {
            this.ws.send(JSON.stringify({
                action: 'send_group_msg',
                params: {
                    user_id: user_id?parseInt(user_id.replace('QQ:','')):undefined,
                    group_id: parseInt(group_id.replace('QQ-Group:','')),
                    message
                }
            }))
        }
    }
    sendMsg({
        user_id,
        group_id,
        message
    }:{
        user_id:string,
        group_id?:string,
        message:string
    }):void {
        if (this.ws.readyState===this.ws.OPEN) {
            console.log('replyer'+group_id,group_id&&parseInt(group_id.replace('QQ-Group:','')))
            if (group_id) {
                // this.ws.send(JSON.stringify({
                //     action: 'send_msg',
                //     params: {
                //         user_id: parseInt(user_id.replace('QQ:','')),
                //         group_id: group_id? parseInt(group_id.replace('QQ-Group:','')):undefined,
                //         message
                //     }
                // }))
                this.sendMsgGroup({user_id,group_id,message})
            } else {
                this.sendMsgPri({user_id,message})
            }
        }
    }

    getGroupInfo(group:number) {
        return new Promise<GroupInfo>((resolve,reject) => {
            const Info = groupCache.get(group)
            if (!Info) {
                if (!this.event.has(`group_info_${group}`)) {
                    this.event.set(`group_info_${group}`,[resolve])
                } else {
                    const arr = this.event.get(`group_info_${group}`) as Function[]
                    arr.push(resolve)
                    setTimeout(() => {
                        const index = arr.findIndex(v => v===resolve)
                        arr.splice(index,1)
                    },errorDelay)
                }
                this.ws.send(JSON.stringify({
                    action: 'get_group_info',
                    params: {
                        group_id: group
                    }
                }))
                // setTimeout(() => {
                //     reject(`获取账号为${group}的群组的信息失败`)
                // },errorDelay)
            } else {
                resolve(Info)
            }
        }).then((res) => {
            groupCache.set(group, res)
            return res
        })
    }

    getPersonInfo(qq:number) {
        return new Promise<PersonInfo>((resolve,reject) => {
            const Info = qqCache.get(qq)
            if (!Info) {
                if (!this.event.has(`person_info_${qq}`)) {
                    this.event.set(`person_info_${qq}`,[resolve])
                } else {
                    const arr = this.event.get(`person_info_${qq}`) as Function[]
                    arr.push(resolve)
                    setTimeout(() => {
                        const index = arr.findIndex(v => v===resolve)
                        arr.splice(index,1)
                    },errorDelay)
                }
                this.ws.send(JSON.stringify({
                    action: 'get_stranger_info',
                    params: {
                        user_id: qq
                    }
                }))
                // setTimeout(() => {
                //     reject(`获取账号为${qq}的用户的信息失败`)
                // },errorDelay)
            } else {
                resolve(Info)
            }
        }).then((res) => {
            qqCache.set(qq, res)
            return res
        })
    }
    getRoleInGroup(group_id:number,user_id:number) {
        return new Promise<PersonInGroup>((resolve,reject) => {
            const Info = grouproleCache.get(`${group_id}_${user_id}`)
            if (!Info) {
                const key = `group_role_${group_id}_${user_id}`
                if (!this.event.has(key)) {
                    this.event.set(key,[resolve])
                } else {
                    const arr = this.event.get(key) as Function[]
                    arr.push(resolve)
                    setTimeout(() => {
                        const index = arr.findIndex(v => v===resolve)
                        arr.splice(index,1)
                    },errorDelay)
                }
                this.ws.send(JSON.stringify({
                    action: 'get_group_member_info',
                    params: {
                        group_id,
                        user_id
                    }
                }))
                console.log(`尝试获取用户${user_id}在群${group_id}的角色状态`)
            } else {
                resolve(Info)
            }
        }).then(res => {
            if (!grouproleCache.has(`${group_id}_${user_id}`)) {
                grouproleCache.set(`${group_id}_${user_id}`,res)
            }
            return res
        })
    }
    destroy() {
        this.ws.close()
        this.onMessage = null
        this.event.clear()
        
    }
}

export default function createOneBotConnect(url:string,options?: ws.ClientOptions | undefined,self?:number) {
    return new OneBotMsgSender(new ws(url,options),self)
}

type GroupInfo = {
    group_id: number
    group_name: string
    member_count?: number
    max_member_count?: number
}

type PersonInfo = {
    user_id: number
    nickname: string
}

type PersonInGroup = {
    user_id: number
    group_id: number
    nickname: string
    card: string
    sex: 'male'|'female'|'unknown'
    age: number
    area: string
    join_time: number
    last_sent_time: number
    level: string
    role: 'owner'|'admin'|'member'
    unfriendly: boolean
    title: string
    title_expire_time: number
    card_changeable: boolean
}

type ReturnType<T = any> = {
    status: 'ok'|'failed',
    retcode: number,
    data: T
}

class CmdArgs {
        /** 当前命令，与指令的name相对，例如.ra时，command为ra */
        command: string;
        /** 指令参数，如“.ra 力量 测试”时，参数1为“力量”，参数2为“测试” */
        args: string[];
        /** 当前被at的有哪些 */
        at: {userId:string}[];
        /** 参数的原始文本 */
        rawArgs: string;
        /** 我被at了 */
        amIBeMentioned: boolean;
        /** 同上，但要求是第一个被at的 */
        amIBeMentionedFirst: boolean;
        /** 一种格式化后的参数，也就是中间所有分隔符都用一个空格替代 */
        cleanArgs: string;
        // 暂不提供，未来可能有变化
        // specialExecuteTimes: number;
        // 但是额外指出， `ra10#50` 时此项 = 10，并且 argv[0] 会被处理为 50；请注意这一点
    
        /** 获取关键字参数，如“.ra 50 --key=20 --asm”时，有两个kwarg，一个叫key，一个叫asm */
        // getKwarg(key: string): Kwarg;
        /** 获取第N个参数，从1开始，如“.ra 力量50 推门” 参数1为“力量50”，参数2是“推门” */
        constructor(
            command: string,
            args: string[],
            at: {userId:string}[],
            rawArgs: string,
            amIBeMentioned: boolean,
            amIBeMentionedFirst: boolean,
            cleanArgs: string,
        ){
            this.command = command
            this.args = args
            this.at = at
            this.rawArgs = rawArgs
            this.amIBeMentioned = amIBeMentioned
            this.amIBeMentionedFirst = amIBeMentionedFirst
            this.cleanArgs = cleanArgs
        }
        getArgN(n: number) {
            return this.args[n-1]
        }
        /** 分离前缀 如 `.stdel力量` => [del,力量] ，直接修改 argv 属性*/
        // chopPrefixToArgsWith(...s: string[]): boolean
        /** 吃掉前缀并去除复数空格 `set xxx  xxx` => `xxx xxx`，返回修改后的字符串和是否修改成功的布尔值  */
        // eatPrefixWith(...s: string[]): [string, boolean]
        /** 将第 n 个参数及之后参数用空格拼接起来; 如指令 `send to qq x1 x2`,n=3返回 `x1 x2` */
        // getRestArgsFrom(n: number): number
        /** 检查第N项参数是否为某个字符串，n从1开始，若没有第n项参数也视为失败 */
        // isArgEqual(n: number, ...s: string[]): boolean
    
}