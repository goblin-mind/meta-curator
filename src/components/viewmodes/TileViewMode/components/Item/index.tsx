import React, { useCallback, useEffect, useMemo, useState } from 'react'
import classNames from 'classnames'
import { Colors, Icon } from '@blueprintjs/core'

import { TruncatedText } from '$src/components/viewmodes/components/TruncatedText'
import { InlineEditEvent, ItemMouseEvent, makeEvent } from '$src/hooks/useViewMode'
import { DraggedObject, FileViewItem } from '$src/types'
import { useFileClick } from '$src/hooks/useFileClick'
import { useDragFile } from '$src/hooks/useDragFile'

import styled from 'styled-components'
import { ipcRenderer } from 'electron'
import { FileDescriptor } from '$src/services/Fs'
import { TagCount } from '$src/IsoTagTypes'

interface ImgProps {
    iconSize?: string
    tileHeight?: string
}

const Wrapper = styled.div`
    position: relative;
    display: inline-block;
    overflow: hidden;
    alignself: start;
    max-width: 246px;
`

const StyledImg = styled.img<ImgProps>`
    height: ${(props) => props.tileHeight || 'auto'};
    position: relative;
    left: 50%;
    transform: translateX(-50%);
`
interface ButtonProps {
    bgc?: string
    // Include other custom props as needed
}
const Button = styled.button<ButtonProps>`
    position: absolute;
    background: ${(props) => props.bgc || 'rgba(155, 155, 155, 0.6)'};
    border: none;
    cursor: pointer;
`

interface Props {
    item: FileViewItem
    itemIndex: number
    //width: number
    margin: number
    iconSize: number
    isDarkModeActive: boolean
    onItemClick: (event: ItemMouseEvent) => void
    onItemDoubleClick: (event: ItemMouseEvent) => void
    onItemRightClick: (event: ItemMouseEvent) => void
    onInlineEdit: (event: InlineEditEvent) => void
    getDragProps: (index: number) => DraggedObject
    cacheManager: any
    relatedTags: string[]
}

export const Item = ({
    onItemClick,
    onItemDoubleClick,
    onItemRightClick,
    onInlineEdit,
    getDragProps,
    margin,
    //width,
    item,
    itemIndex,
    iconSize,
    isDarkModeActive,
    cacheManager,
    relatedTags,
}: Props) => {
    const clickHandler = makeEvent(itemIndex, item, onItemClick)
    const doubleClickHandler = makeEvent(itemIndex, item, onItemDoubleClick)
    const rightClickHandler = makeEvent(itemIndex, item, onItemRightClick)
    const dragProps = getDragProps(itemIndex)
    const { dragRef, dragPreview } = useDragFile({
        isDarkModeActive,
        dragProps,
    })
    const mouseProps = useFileClick({
        clickHandler,
        doubleClickHandler,
        rightClickHandler,
        // we don't want to react on clicks on empty/blank area
        shouldSkipEvent: useCallback(
            (event: React.MouseEvent<HTMLElement>) => (event.target as HTMLElement).tagName === 'DIV',
            [],
        ),
    })

    const [imageSrc, setImageSrc] = useState(null)
    const sortedLeastUsedTags = useMemo(() => {
        let toggled = item?.tags ? item.tags.split(',') : []
        const untoggled = relatedTags
            .filter((tag) => toggled.indexOf(tag) < 0)
            .map((tag) => {
                return { toggled: false, tag }
            })
        toggled = toggled.map((tag: string) => {
            return { toggled: true, tag }
        })
        const result = []
        while (result.length < 20 && (toggled.length > 0 || untoggled.length > 0)) {
            if (toggled.length > 0) {
                result.push(toggled.pop())
            } else if (untoggled.length > 0) {
                result.push(untoggled.pop())
            }
        }
        return result
    }, [relatedTags, item?.tags])

    const isImage = item.nodeData.type === 'img'
    useEffect(() => {
        if (isImage) {
            // Open the IndexedDB connection
            const fetchImage = async () => {
                const cachres = await cacheManager.get(
                    item.nodeData.dir.concat(
                        '/',
                        item.nodeData.fullname.length > 0
                            ? item.nodeData.fullname
                            : item.nodeData.name.concat(item.nodeData.extension),
                    ),
                )
                const { base64data, biggestUrl } = cachres

                // Update the component state with the retrieved data URL
                if (base64data) {
                    //const base64 = await blobToBase64(dataUrl)

                    setImageSrc(base64data)
                }
                if (biggestUrl) {
                    // setBiggestUrl(biggestUrl)
                    item.imageUrl = biggestUrl
                }
            }

            fetchImage()
        }
    }, [item])

    const handleClick = (tag: string, item: any) => {
        const getPath = (file: any) => [file.nodeData.dir, file.name].join('/').replaceAll('\\', '/')
        fetch('http://localhost:3000/tags/resources', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ fileNames: [getPath(item)], tagNames: [tag] }),
        })
        // ipcRenderer.invoke('apply-tags', { fileNames: [getPath(item)], tagNames: [tag] })
        if (item.tags && item.tags.indexOf(tag) < 0) {
            item.tags += `,${tag}`
        }
        console.log(tag, item)
    }

    return (
        <>
            <div
                ref={dragRef}
                className={classNames(item.isSelected && 'selected', item.className)}
                style={{
                    margin: `${margin}px`,
                    width: '246px',
                }}
                {...mouseProps}
            >
                {item.nodeData.type === 'img' && imageSrc ? (
                    <div
                        style={{
                            position: 'relative',
                        }}
                    >
                        <Wrapper>
                            <StyledImg src={imageSrc} alt={item.name} tileHeight={`${iconSize}px`} />
                        </Wrapper>
                        {sortedLeastUsedTags.slice(0, 10).map(({ tag, toggled }, index: any) => (
                            <Button
                                key={tag}
                                style={{
                                    top: `${5 + index * 20}px`,
                                    left: '5px',
                                }}
                                bgc={toggled ? 'blue' : undefined}
                                onClick={() => handleClick(tag, item)}
                            >
                                {tag}
                            </Button>
                        ))}
                        {sortedLeastUsedTags.slice(10, 20).map(({ tag, toggled }, index: any) => (
                            <Button
                                key={tag}
                                style={{
                                    top: `${5 + index * 20}px`,
                                    right: '5px',
                                }}
                                bgc={toggled ? 'blue' : undefined}
                                onClick={() => handleClick(tag, item)}
                            >
                                {tag}
                            </Button>
                        ))}
                    </div>
                ) : (
                    <Icon
                        icon={item.icon}
                        size={iconSize}
                        color={Colors.GRAY2}
                        title={item.name}
                        className="icon"
                        style={{ position: 'relative' }}
                    />
                )}
                <TruncatedText
                    lines={2}
                    item={item}
                    selectedCount={dragProps.fileState.selected.length}
                    onInlineEdit={onInlineEdit}
                />
            </div>
            {dragPreview}
        </>
    )
}
