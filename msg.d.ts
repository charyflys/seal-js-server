import { MsgContent } from "./recivebase"

export interface PriMsgContent extends MsgContent {
    message_type: 'private'
    sub_type: 'friend'
    message_id: number
    user_id: number
    message: Message[]
    raw_message: string
    font: number
    sender: MsgSender
}

export interface GroupMsgContent extends MsgContent {
    message_type: 'group'
    sub_type: 'normal'|'anonymous'
    message_id: number
    group_id: number
    user_id: number
    anonymous?: any
    message: Message[]
    raw_message: string
    font: number
    sender: MsgSenderGroup
}

export interface MsgSender {
    user_id: number
    nickname: string
    sex?: string
    age?: number
}

export interface MsgSenderGroup extends MsgSender {
    card?: string
    area?: string
    level?: string
    role?: string
    title?: string
}

export type TextMsg = {
    type: 'text'
    data: {
        text: string
    }
}

export type QQFaceMsg = {
    type: 'face'
    data: {
        id: string
    }
}

export type ImgMsg = {
    type: 'image'
    data: {
        file: string
        url: string
        sub_type?: number,
        file_id?: string
        file_size?: string
        file_unique?: string
    }
}

export type VideoMsg = {
    type: 'video'
    data: {
        file: string
    }
}

export type AtMsg = {
    type: 'at'
    data: {
        qq: string
    }
}

export type Message = TextMsg |QQFaceMsg | ImgMsg|VideoMsg|AtMsg

export type SubmitMsg = Message[]|string