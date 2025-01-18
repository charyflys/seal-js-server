import { SealMsgContext, SealMsg, SealCmdArgs } from "../sealdiceContext"

// 基础的支持海豹插件各种操作的连接对象
export interface BotConnection {
    // 连接的常规指令触发
    onMessage: null|( ((ctx: SealMsgContext,msg: SealMsg,args: SealCmdArgs) => void))
    // 非指令消息
    onNotCmd: null|( ((ctx: SealMsgContext,msg: SealMsg) => void))
    // 检查是否为master
    checkMaster: null|((qq:number|string) => boolean)
    // 检查EndPoint是否一致
    checkEndPoint:(user_id:string) => boolean
    // 发送消息，允许私发或者群组发，格式可能要改
    sendMsg:({user_id,group_id,message}:{user_id:string,group_id?:string,message:string}) => any
    // 私发消息
    sendMsgPri:({user_id,message}:{user_id:string,message:string}) => any
    // 群组发送消息
    sendMsgGroup:({user_id,group_id,message}:{user_id?:string,group_id:string,message:string}) => any
    // 获取EndPoint的userId
    getEndPoint:()=>string
    getPlayerInfo: (userId:string) => PlayerInfo|null
}

type PlayerInfo = {
    userId: string
    nickname: string
}