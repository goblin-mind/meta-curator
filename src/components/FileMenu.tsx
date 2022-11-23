import * as React from 'react'
import { Menu, MenuItem, MenuDivider } from '@blueprintjs/core'
import { observer, inject } from 'mobx-react'
import { withTranslation, WithTranslation } from 'react-i18next'

import { AppState } from '$src/state/appState'
import { File } from '$src/services/Fs'

interface FileMenuProps extends WithTranslation {
    onFileAction: (action: string) => void
    selectedItems: File[]
    isDisabled: boolean
}

interface InjectedProps extends FileMenuProps {
    appState: AppState
}

export const FileMenuClass = inject('appState')(
    observer(
        class FileMenuClass extends React.Component<FileMenuProps> {
            constructor(props: FileMenuProps) {
                super(props)
            }

            private get injected(): InjectedProps {
                return this.props as InjectedProps
            }

            private onNewfolder = (): void => {
                this.props.onFileAction('makedir')
            }

            private onPaste = (): void => {
                this.props.onFileAction('paste')
            }

            private onDelete = (): void => {
                this.props.onFileAction('delete')
            }

            public render(): React.ReactNode {
                const { appState } = this.injected
                const clipboardLength = appState.clipboard.files.length
                const { selectedItems, t, isDisabled } = this.props

                return (
                    <React.Fragment>
                        <Menu>
                            <MenuItem
                                disabled={isDisabled}
                                text={t('COMMON.MAKEDIR')}
                                icon="folder-new"
                                onClick={this.onNewfolder}
                            />
                            <MenuDivider />
                            <MenuItem
                                text={t('FILEMENU.PASTE', { count: clipboardLength })}
                                icon="duplicate"
                                onClick={this.onPaste}
                                disabled={!clipboardLength || isDisabled}
                            />
                            <MenuDivider />
                            <MenuItem
                                text={t('FILEMENU.DELETE', { count: selectedItems.length })}
                                onClick={this.onDelete}
                                intent={(selectedItems.length && 'danger') || 'none'}
                                icon="delete"
                                disabled={!selectedItems.length || isDisabled}
                            />
                        </Menu>
                    </React.Fragment>
                )
            }
        },
    ),
)

const FileMenu = withTranslation()(FileMenuClass)

export { FileMenu }
