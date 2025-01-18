import fs from 'fs'
import path from 'path'
const scriptsPath = './scripts/'
const extensionsPath = './extensions/'

// 插件载入暂存
if (!fs.existsSync(scriptsPath)) {
    fs.mkdirSync(scriptsPath)
}

// 插件长期存放库
if (!fs.existsSync(extensionsPath)) {
    fs.mkdirSync(extensionsPath)
}

// 插件版本信息检查
// 一开始设计思路是，海豹实际上没有对插件的存放做规范化
// 所以设计上去根据脚本自身信息做一个规范化，虽然可能有脚本不写这个......
// 但是也总比两个本质内容相同的脚本取了不同名称丢进去然后导致海豹内存爆炸更好.jpg
export function checkImportScripts() : ScriptInfos {
    let scriptsInfo: ScriptInfos = {}
    // 读取已经缓存的插件
    if (fs.existsSync(path.join(extensionsPath, 'info.json'))) {
        scriptsInfo = JSON.parse(fs.readFileSync(path.join(extensionsPath, 'info.json')).toString('utf8'))
    }
    const filenames = fs.readdirSync(scriptsPath)
    // 从暂存区录入文件
    filenames.forEach(filename => {
        const file = fs.readFileSync(path.join(scriptsPath, filename), 'utf-8')
        const metadata = readUserScript(file)
        const extensionPath = path.join(extensionsPath, metadata['name'])
        dirConfirm(extensionPath)
        const info = scriptsInfo[metadata['name']]
        if (!info) {
            scriptsInfo[metadata['name']] = [metadata]
        } else if (info instanceof Array) {
            const sameFileIndex = info.findIndex(v => {
                return v.name === metadata.name && v.author === metadata.author && v.version === metadata.version
            })
            if (sameFileIndex === -1) {
                info.push(metadata)
            }
            else {
                info.splice(sameFileIndex, 1, metadata)
            }
        }
        // 录入的文件移动到存储区
        fs.writeFileSync(path.join(extensionPath, getScriptPath(metadata)), file)
        fs.rmSync(path.join(scriptsPath, filename))
    })
    // 将暂存区录入的文件信息存储到缓存文件中
    fs.writeFileSync(path.join(extensionsPath, 'info.json'), JSON.stringify(scriptsInfo))
    return scriptsInfo
}
// 根据版本号对同名插件进行排序
export function getJsVersion(infos: ScriptInfos) : MetaInfo[] {
    const arr:MetaInfo[] = []
    for(const name in infos) {
        const infoversion = infos[name]
        try {
            const info = infoversion.sort((a,b) => {
                const av = a.version.split('.').map(v => parseInt(v))
                const bv = b.version.split('.').map(v => parseInt(v))
                return av[0] - bv[0] + (av[1] - bv[1])*.01 + (av[2] - bv[2])*.0001
            })[infoversion.length - 1]
            if (info) {
                arr.push(info)
            }
        } catch(e) {
            console.log(e)
        }
    }
    return arr
}

// 加载插件的内容、插件对应存储、插件配置
export function getJsAndStorage(jsversion: MetaInfo[]) {
    const scripts:ScriptInfo[] = []
    jsversion.forEach(v => {
        try {
            scripts.push(new ScriptInfo(v,getExtenJS(v),getStorage(v),getConfig(v)))
        } catch(e) {
            console.log(e)
        }
    })
    return scripts
}

export class ScriptInfo {

    constructor(
        public info: MetaInfo,
        public script: string,
        public storage: Map<string,string>,
        public config: Map<string,any>,
    ) {

    }
    toJSON() {
        return {
            info:this.info,
            storage: this.storage,
            config:this.config
        }
    }
}
// 获取对应插件内容
function getExtenJS(info: MetaInfo) {
    if (!info) return ''
    return fs.readFileSync(path.join(extensionsPath,info.name,getScriptPath(info)),'utf-8')
}
// 获取对应插件名称的缓存
function getStorage(info: MetaInfo) {
    let store = new Map<string,string>()
    try {
        if (info===null) return store
        if (fs.existsSync(path.join(extensionsPath,info.name,'db.json'))) {
            const data =fs.readFileSync(path.join(extensionsPath,info.name,'db.json'),'utf-8')
            store = new Map(Object.entries(JSON.parse(data)))
        }
    } catch(e)  {
        console.log(e)
    }
    return store
}
// 获取对应插件名称的配置
function getConfig(info: MetaInfo) {
    let store = new Map<string,any>()
    try {
        if (fs.existsSync(path.join(extensionsPath,info.name,getScriptPath(info),'config.json'))) {
            store = new Map(Object.entries(JSON.parse(fs.readFileSync(path.join(extensionsPath,info.name,'config.json'),'utf-8'))))
        }
    } catch(e)  {
        console.log(e)
    }
    return store
}
export function setStorage(info: MetaInfo, storage:Map<string,string>) {
    try {
        fs.writeFileSync(
            path.join(path.join(extensionsPath,info.name,'db.json')),
            JSON.stringify(Object.fromEntries(storage))
        )
    } catch (e) {
        console.log(e)
        return false
    }
    return true
}
export function setConfig(info: MetaInfo, config:Map<string,any>) {
    try {
        fs.writeFileSync(
            path.join(path.join(extensionsPath,info.name,'config.json')),
            JSON.stringify(Object.fromEntries(config))
        )
    } catch (e) {
        console.log(e)
        return false
    }
    return true
}
// 全局配置
const configFile = './config.json'
export function getBaseConfig() {
    let res = new Map<string,any>()
    if (fs.existsSync(configFile)) {
        try {
            res = new Map<string,any>(Object.entries(JSON.parse(fs.readFileSync(configFile,'utf-8'))))
        } catch(e) {
            console.log(e)
        }
    }
    return res
}
export function setBaseConfig(config:Map<string,any>) {
    try {
        fs.writeFileSync(
            configFile,
            JSON.stringify(Object.fromEntries(config))
        )
    } catch (e) {
        console.log(e)
        return false
    }
    return true
}


function readUserScript(content: string) {
    const metadataRegex = /\/\/ *==UserScript==([\s\S]*)\/\/ *==\/UserScript==/;
    const match = content.match(metadataRegex);
    const metadata: { [key: string]: string } = {};
    if (match) {
        const metadataBlock = match[1];
        const arr = metadataBlock.split('\n')
        const fieldRegexOther = /\@(\w+) +(\S+)/;
        arr.forEach(v => {
            const matchRes = v.match(fieldRegexOther)
            if (matchRes) metadata[matchRes[1]] = matchRes[2]
        })
        metadata.loadtime = Math.floor(Date.now()/1000).toString()
    }
    return metadata as MetaInfo
}

function dirConfirm(pathurl: string) {
    if (!fs.existsSync(pathurl)) {
        fs.mkdirSync(pathurl)
    }
}

function getScriptPath(info: MetaInfo) {
    return `${info.name}_${info.author}_${info['version'] || '1.0.0'}.js`
}

type ScriptInfos = {
    [key: string]: MetaInfo[]
}

export type MetaInfo = {
    name: string
    author: string
    version: string
    loadtime: string
    description?: string
    timestamp?: string
    homepageURL?: string
    require?: string
    depends?: string
}