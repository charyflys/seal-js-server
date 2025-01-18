# 海豹插件虚拟机

这个项目最初的思路是因为非nodejs的虚拟机对于js的api支持不是非常好（没事就panic，主要指setTimeout这类方法）

因此有个设想就是直接走Nodejs运行

这个项目是后端，不过对应的前端已经嵌合进去了

写的有点乱，如果有什么好的思路请提pr，虽然我可能很久才能看到

目前对于插件内置api的支持性如下

- ext
  - new
  - newCmdExecuteResult
  - register(x)
  - find
  - newCmdItemInfo
  - 配置系列api(未测试)
- replyToSender
- replyPerson
- replyGroup
- getCtxProxyFirst
- getEndPoints
- newMessage
- createTempCtx
- registerTask(x)

ExtInfo类的api支持

- cmdMap
- isLoaded
- storageSet
- storageGet
- noNotCommandReceived

对于界面功能支持上，如下

- 插件上传，版本选择，插件状态变更
- 插件删除(x)
- 插件配置修改(x)
- ui测试界面的at功能，图片功能(x)
- 全局配置修改(x)

另外目前有个和海豹实现不一致的，reply在这里允许直接编辑ctx对象丢进去，海豹必须要createTempCtx，因此如果使用这个服务器测试用的话最好自己在海豹上再测试一遍