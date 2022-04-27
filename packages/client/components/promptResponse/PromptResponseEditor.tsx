import styled from '@emotion/styled'
import {Editor as EditorState} from '@tiptap/core'
import Placeholder from '@tiptap/extension-placeholder'
import {Editor, EditorContent, EditorEvents, JSONContent, useEditor} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import React, {useState} from 'react'

const StyledEditor = styled('div')`
  .ProseMirror p.is-editor-empty:first-child::before {
    color: #adb5bd;
    content: attr(data-placeholder);
    float: left;
    height: 0;
    pointer-events: none;
  }
  .ProseMirror-focused:focus {
    outline: none;
  }
`

interface Props {
  autoFocus?: boolean
  content: JSONContent | null
  handleSubmit: (editor: EditorState) => void
  readOnly: boolean
  placeholder: string
}

const PromptResponseEditor = (props: Props) => {
  const {autoFocus: autoFocusProp, content, handleSubmit, readOnly, placeholder} = props
  const [_isEditing, setIsEditing] = useState(false)
  const [autoFocus, setAutoFocus] = useState(autoFocusProp)

  const setEditing = (isEditing: boolean) => {
    setIsEditing(isEditing)
    setAutoFocus(false)
  }

  const onUpdate = () => {
    setEditing(true)
  }

  const onSubmit = async ({editor: newEditorState}: EditorEvents['blur']) => {
    setEditing(false)
    handleSubmit(newEditorState)
  }

  const editor: Editor | null = useEditor({
    content,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder
      })
    ],
    autofocus: autoFocus,
    onUpdate,
    onBlur: onSubmit,
    editable: !readOnly
  })

  return (
    <StyledEditor>
      <EditorContent editor={editor} />
    </StyledEditor>
  )
}
export default PromptResponseEditor
