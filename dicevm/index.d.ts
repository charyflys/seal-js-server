
export const dc = {
    newVMForPlaygournd(): VMForPlayground
}
export class VMForPlayground {
    Error: boolean
    RestInput: string


    SetConfig(config: DiceConfig): void
    Run(text: string): void
    GetErrorText(): string
    GetDetailText(): string
    Ret: {
        ToString(): string
    }
}
export type DiceConfig = {
    OpCountLimit: number
    PrintBytecode: boolean
    EnableDiceWoD: boolean
    EnableDiceCoC: boolean
    EnableDiceFate: boolean
    EnableDiceDoubleCross: boolean
}


