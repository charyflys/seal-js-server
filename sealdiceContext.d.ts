export interface SealMsgContext {
    endPoint: {
        userId: string
        nickname?: string
    };
    /** 当前群信息 */
    group?: GroupInfo;
    /** 当前群的玩家数据 */
    player: GroupPlayerInfo;
    /** 当前群内是否启用bot（注:强制@时这个值也是true，此项是给特殊指令用的） */
    isCurGroupBotOn: boolean;
    /** 是否私聊 */
    isPrivate: boolean;
    /** 权限等级 40邀请者 50管理 60群主 100master */
    privilegeLevel: number;
    /** 代骰附加文本 */
    delegateText: string
    /** 对通知列表发送消息 */
    // notice(text: string): void
}

export interface SealMsg {
    guildId: any;
    /** 当前平台，如QQ */
    platform: string;
    /** 消息内容 */
    message: string;
    /** 发送时间 */
    time: number;
    /** 群消息/私聊消息 */
    messageType: 'group' | 'private';
    /** 群ID */
    groupId?: string;
    /** 发送者信息 */
    sender: {
        nickname: string;
        userId: string;
    };
    /** 原始ID，用于撤回等情况 */
    rawId: string | number;
}

export interface SealCmdArgs {
    /** 当前命令，与指令的name相对，例如.ra时，command为ra */
    command: string;
    /** 指令参数，如“.ra 力量 测试”时，参数1为“力量”，参数2为“测试” */
    args: string[];
    /** 当前被at的有哪些 */
    at: {userId: string}[];
    /** 参数的原始文本 */
    rawArgs: string;
    /** 我被at了 */
    amIBeMentioned: boolean;
    /** 同上，但要求是第一个被at的 */
    amIBeMentionedFirst: boolean;
    /** 一种格式化后的参数，也就是中间所有分隔符都用一个空格替代 */
    cleanArgs: string;
}


interface GroupInfo {
    active: boolean;
    groupId: string;
    groupName: string;
    /** 最后指令时间(时间戳) */
    recentCommandTime: number;
}

interface GroupPlayerInfo {
    /** 用户昵称 */
    name: string;
    /** 用户ID */
    userId: string;
    /** 上次执行指令时间 */
    lastCommandTime: number;
    /** 上次发送指令时间(即sn) */
    autoSetNameTemplate: string;
}