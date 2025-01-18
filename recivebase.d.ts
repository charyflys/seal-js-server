export interface BaseContent {
    time: number
    self_id: number
}

export interface MsgContent extends BaseContent {
    post_type: 'message'
}

export interface NoticeContent extends BaseContent {
    post_type: 'notice'
}

export interface ReqContent extends BaseContent {
    post_type: 'request'
}

export interface MetaContent extends BaseContent {
    post_type: 'meta_event'
}

