import { BotConnection } from './connect'
import { SealCmdArgs, SealMsg, SealMsgContext } from '../sealdiceContext'

class UIRobot implements BotConnection{
    self: 9999
    public onMessage: null| ((ctx: SealMsgContext,msg: SealMsg,args: SealCmdArgs) => void)
    public onNotCmd: null| ((ctx: SealMsgContext,msg: SealMsg) => void)
    public checkMaster: ((num: string|number) => boolean) | null
    msg: ReplyItem[]
    constructor() {
        this.self = 9999
        this.onMessage = null
        this.onNotCmd = null
        this.checkMaster = null
        this.msg = []
    }
    checkEndPoint(user_id: string) {
        return user_id==='UI:9999'
    }
    getEndPoint() {
        return `UI:${this.self}`
    }
    sendMsgPri ({ user_id, message }: { user_id: string; message: string }):void {
        this.sendMsg({user_id,message})
    }
    sendMsgGroup ({ user_id, group_id, message }: { user_id?: string; group_id: string; message: string }):void {
        this.sendMsg({user_id:'',message,group_id:group_id||''})
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
        this.msg.push({
            msg: message,
            groupId: group_id||'',
            sender: 'UI:9999',
            reciver: user_id,
            time: Date.now()
        })
    }
    getMessage(ctx: SealMsgContext,msg: SealMsg) {
        this.msg.push({
            msg: msg.message,
            groupId: msg.groupId||'',
            reciver: ctx.endPoint.userId,
            sender: msg.sender.userId,
            time: Date.now()
        })
        const checkText = msg.message.trim()
        const match = (checkText.match(/^(\.|。)\S+(\s|\n)*/) as RegExpMatchArray)
        if ((checkText.startsWith('.')||checkText.startsWith('。'))&&match) {
            const cmd = match[0].trim()
            const text = checkText.replace(cmd,'').trim()
            const cmdargs = text.replaceAll('\n',' ').split(/ +/)
            // const ats = context.message.filter(v => v.type==='at').map(v => ({userId:v.data.qq}))
            const args = new CmdArgs(
                cmd.substring(1),
                cmdargs,
                [],
                text,
                false,
                false,
                cmdargs.join(' ')
            )
            // return [ctx,msg,args]
            this.onMessage&&this.onMessage(ctx,msg,args)
        }
        this.onNotCmd&&this.onNotCmd(ctx,msg)
        // return [ctx,msg]
    }
}

export default function createTestRobot() {
    return new UIRobot()
}

interface ReplyItem {
    msg: string
    groupId: string
    reciver: string
    sender: string
    time: number
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