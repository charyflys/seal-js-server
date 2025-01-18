import express from 'express'
import path from 'path'
import dotenv from 'dotenv'
import multer from 'multer'
import fs from 'fs'
import { BotConnection } from './onebot/connect'
import createOneBotConnect from './onebot'
import { ExtControllor } from './sealvm/controllor'
import { checkImportScripts, getJsAndStorage, getJsVersion, setStorage,setConfig, getBaseConfig, setBaseConfig, MetaInfo } from './sealvm/manager'
import createTestRobot from './onebot/webui'
import { SealMsg, SealMsgContext } from './sealdiceContext'
dotenv.config()

const app = express()
const port = process.env.PORT || '3000'

const connects: BotConnection[] = []
let mountTime = Date.now()

const baseConfig = getBaseConfig()
let existJsInfo = checkImportScripts()
let jsVersion = getJsVersion(existJsInfo)
if (baseConfig.has('loadjs')) {
    jsVersion = (baseConfig.get('loadjs') as MetaInfo[]).filter(v => v)
}
const controllor = new ExtControllor([], getJsAndStorage(jsVersion))
if (baseConfig.has('master')) {
    controllor.master = baseConfig.get('master') as number[]
}
function connectInput() {
    const onebotUrls = baseConfig.get('oneboturls')
    if (onebotUrls&&onebotUrls instanceof Array) {
        onebotUrls as {ws:string,qq:number}[]
        onebotUrls.forEach(v => {
            try{
                const onebotconnect = createOneBotConnect(v.ws,undefined,v.qq)
                connects.push(onebotconnect)
            }catch(e) {
                console.log(e)
            }
        })
    }
    // console.log(connects)
    controllor.addConnection(connects)
    connects.splice(0,connects.length)
}
const uiRobot = createTestRobot()
controllor.addConnection([uiRobot])
connectInput()
setInterval(() => {
    controllor.extInfos.forEach(v => {
        setStorage(v.info, v.storage)
    })
}, 10000)
process.on('uncaughtException', function (err) {
    if (err.message.includes('fetch failed')) {
        console.log('fetch 连接失败',err.message)
    } else if(err.message.includes('connect ECONNREFUSED')) {
        console.log('ws连接建立失败',err.message)
    } else {
        throw err
    }
});
const upload = multer()
// 前端页面嵌合
app.use(express.static(path.join(__dirname, 'dist')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});
// 基础配置信息获取，基础信息目前没有很确定怎么做
app.get('/api/base/config',async(req,res) => {
    res.send(resBody(getBaseConfig()))
})

//获取插件信息，包括插件的jsInfo内容以及当前的装载状态
app.get('/api/js/info', async (req, res) => {
    res.send(resBody({
        jsstore:checkImportScripts(),
        running: controllor.extInfos.filter(v => controllor.mounted.find(m => m.enable&&m.name=== v.info.name)),
        mountMsg: controllor.mounted
    }))
})

// 上传插件
app.post('/api/js/upload/',upload.array('file'),async(req,res) => {
    try {
        const data = req.files

        if (data){
            const files = data as any as Express.Multer.File[]
            files.forEach((file) => {
                fs.writeFileSync('./scripts/'+(Math.random()*1000).toFixed()+'.js',file.buffer)
            })
            res.send(resBody(true))
        } else {
            res.send(resBody(false))
        }
    } catch(e:any) {
        res.send(resBody(false,500,e.stack))
    }
})

// 删除插件
app.delete('/api/js',async(req,res) => {
    
})

// 程序重载
app.post('/api/js/reMount',express.json(),async(req, res) => {
    existJsInfo = checkImportScripts()

    const scriptList = req.body as MetaInfo[]
    // if(CompareMeta(controllor.extInfos.map(v => v.info),scriptList)) {
    //     res.send(resBody({
    //         jsstore:existJsInfo,
    //         running: controllor.extInfos.filter(v => !!controllor.mounted.find(m => m.enable&&m.name=== v.info.name)),
    //         mountMsg: controllor.mounted
    //     }))
    //     return
    // }
    if (Date.now() - mountTime<1000) {
        res.send(resBody({
            jsstore:existJsInfo,
            running: controllor.extInfos.filter(v => !!controllor.mounted.find(m => m.enable&&m.name=== v.info.name)),
            mountMsg: controllor.mounted
        }))
        return
    }
    mountTime = Date.now()
    baseConfig.set('loadjs',req.body)
    setBaseConfig(baseConfig)
    controllor.reMount(getJsAndStorage(scriptList))
    res.send(resBody({
        jsstore:existJsInfo,
        running: controllor.extInfos.filter(v => !!controllor.mounted.find(m => m.enable&&m.name=== v.info.name)),
        mountMsg: controllor.mounted
    }))
})

// 获取ui调试对话历史
app.get('/api/test/reply',async(req,res) => {
    const time = req.query.time as string
    if (time) {
        const t = parseInt(time)
        const data = uiRobot.msg.filter(v => v.time>t)
        res.send(resBody(data))
    } else {
        res.send(resBody(uiRobot.msg))
    }
})

// ui调试中的发送消息
app.post('/api/test/send',express.json(),async(req,res) => {
    const context = req.body.context as SealMsgContext
    const msg = req.body.msg as SealMsg
    if (!(context&&msg)) {
        res.send(resBody(false,500,'noData in'))
    }else {
        uiRobot.getMessage(context,msg)
        res.send(resBody(true))
    }

})
// 内存占用计算
// setInterval(() => {
//     const memoryUsage = process.memoryUsage();

//     console.log('RSS (Resident Set Size):', (memoryUsage.rss / 1024 / 1024).toFixed(2), 'MB');
//     console.log('Heap Total:', (memoryUsage.heapTotal / 1024 / 1024).toFixed(2), 'MB');
//     console.log('Heap Used:', (memoryUsage.heapUsed / 1024 / 1024).toFixed(2), 'MB');
//     console.log('External Memory:', (memoryUsage.external / 1024 / 1024).toFixed(2), 'MB');

// },5000)

// 曾试图用于与前端配置差异性比较
function compareMeta(infoA:MetaInfo[],infoB:MetaInfo[]) {
    if (infoA.length!==infoB.length) return false
    infoA = infoA.sort((a,b) => a.name.localeCompare(b.name))
    infoB = infoB.sort((a,b) => a.name.localeCompare(b.name))
    for(let i=0;i<infoA.length;i++) {
        const infoa = infoA[i]
        const infob = infoB[i]
        if (infoa.author!==infob.author||infoa.version!==infob.version) {
            return false
        }
    }
    return true
}
function resBody (data: any,code = 200,msg = 'ok') {
    return JSON.stringify({
        code,
        data,
        msg,
    })
}
app.listen(port, () => {
    console.log(`host http://localhost:${port}`)
})
