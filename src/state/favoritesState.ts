import { IconName } from '@blueprintjs/core'
import { IconNames } from '@blueprintjs/icons'
import { observable, runInAction } from 'mobx'
import { isMac, isWin } from '$src/utils/platform'
import * as nodeDiskInfo from 'node-disk-info'

import { ALL_DIRS } from '$src/utils/platform'
import { WSL_PREFIX, getWSLDistributions, WslDistribution } from '$src/utils/wsl'
import type Drive from 'node-disk-info/dist/classes/drive'
import { TagCount } from '$src/IsoTagTypes'
import { ipcRenderer } from 'electron'
//import { TagNode } from '$src/tagManager'
interface TagNode {
    tag: string
    children: TagNode[]
}
const CHECK_FOR_DRIVES_DELAY = 5000
const CHECK_FOR_WSL_DELAY = 30000

export interface Favorite {
    label: string
    path: string
    icon?: IconName
    isReadOnly: boolean
    isRemovable?: boolean
    isVirtual?: boolean
    hasINotify?: boolean
    depth?: number
}

export const filterSystemDrive = ({ filesystem, mounted }: Drive) => {
    // exclude system volumes from the list of devices we want to show
    if (filesystem.match(/(tmpfs|devfs|map)/) || mounted.match(/^\/(System|boot)/)) {
        return false
    } else {
        return true
    }
}

export class FavoritesState {
    getTagTrees() {
        return fetch('http://localhost:3000/resources/tags/tree').then((response) => response.json())
    }
    buildBookmarks(tagNodes: TagNode[]) {
        let id = 5
        const transformToTreeNode = (node: TagNode, breadcrumbs: string[]): any => {
            breadcrumbs = breadcrumbs.concat([node.tag])
            const path = `query:${breadcrumbs.join(' AND ')}`
            return {
                id: id++, // Unique ID for the node
                childNodes: node.children.map((child) => transformToTreeNode(child, breadcrumbs)),
                label: `${node.tag}`,
                path,
                icon: IconNames.FOLDER_CLOSE,
                isReadOnly: false,
                depth: breadcrumbs.length,
                key: `p_${breadcrumbs.join('_')}`,
                isExpanded: true,
                nodeData: path,
            }
        }
        const filteredList = tagNodes.map((tagNode) => {
            return transformToTreeNode(tagNode, [])
        })
        runInAction(() => this.bookmarks.replace(filteredList))
    }
    shortcuts = observable<Favorite>([])
    places = observable<Favorite>([])
    distributions = observable<Favorite>([])
    bookmarks = observable<any>([])
    previousPlaces: Drive[] = []

    buildShortcuts(): void {
        this.shortcuts.replace(
            Object.entries(ALL_DIRS).map((dir: string[]) => ({
                label: dir[0],
                path: dir[1],
                icon: IconNames.DATABASE,
                isReadOnly: false,
            })),
        )
    }

    async getDrivesList(): Promise<Drive[]> {
        const drives = await nodeDiskInfo.getDiskInfo()
        return drives.filter(filterSystemDrive)
    }

    buildDistributions(distribs: WslDistribution[]): void {
        runInAction(() =>
            this.distributions.replace(
                distribs.map(({ name, hasINotify }) => ({
                    label: name,
                    path: `${WSL_PREFIX}${name}\\`,
                    icon: IconNames.SOCIAL_MEDIA,
                    hasINotify,
                    isReadOnly: true,
                })),
            ),
        )

        console.log('build WSL distributions', this.distributions)
    }

    buildPlaces(drives: Drive[]): void {
        const filteredList: Favorite[] = drives.reduce((elements, { mounted }) => {
            // mac stuff
            const label = mounted.replace('/Volumes/', '').replace(/^\/$/, isMac ? 'Macintosh HD' : '/')
            const favorite: Favorite = {
                label,
                path: mounted,
                icon: IconNames.FOLDER_CLOSE,
                isReadOnly: false,
            }
            elements.push(favorite)

            return elements
        }, [])

        runInAction(() => this.places.replace(filteredList))
    }

    launchTimeout(immediate = false, callback: () => void, timeout: number): void {
        if (immediate) {
            callback()
        } else {
            setTimeout(callback, timeout)
        }
    }

    buildDrivesList(): void {
        this.buildShortcuts()
        this.launchTimeout(true, this.checkForNewDrives, CHECK_FOR_DRIVES_DELAY)
        // Only check for WSL distributions on Windows
        isWin && this.launchTimeout(true, this.checkForNewDistributions, CHECK_FOR_WSL_DELAY)
    }

    checkForNewDistributions = async (): Promise<void> => {
        const distribs = await getWSLDistributions()
        if (distribs.length !== this.distributions.length) {
            this.buildDistributions(distribs)
        }

        // restart timeout in any case
        this.launchTimeout(false, this.checkForNewDistributions, CHECK_FOR_WSL_DELAY)
    }

    /**
     * checks if new drives: if new drives are found, re-generate the places
     */
    checkForNewDrives = async (): Promise<void> => {
        const usableDrives = await this.getDrivesList()

        if (this.hasDriveListChanged(usableDrives)) {
            this.previousPlaces = usableDrives
            this.buildPlaces(usableDrives)
            const tags = await this.getTagTrees()

            this.buildBookmarks(tags)
        }
        // restart timeout in any case
        this.launchTimeout(false, this.checkForNewDrives, CHECK_FOR_DRIVES_DELAY)
    }

    hasDriveListChanged(newList: Drive[]): boolean {
        if (newList.length !== this.previousPlaces.length) {
            return true
        } else {
            const newString = newList
                .filter(filterSystemDrive)
                .reduce((str: string, { mounted }: Drive) => `${str}${mounted}`, '')

            const oldString = this.previousPlaces
                .filter(filterSystemDrive)
                .reduce((str: string, { mounted }: Drive) => `${str}${mounted}`, '')

            return oldString !== newString
        }
    }

    constructor() {
        this.buildDrivesList()
    }
}
