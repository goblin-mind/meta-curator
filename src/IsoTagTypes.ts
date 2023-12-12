export type TagRow = {
    tag: string
}
export type TagCount = {
    tag: string
    count: number
}

export type TagNode = {
    tag: string
    children: TagNode[]
}
