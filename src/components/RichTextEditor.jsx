import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import {
    Bold, Italic, Underline as UnderlineIcon,
    Heading1, Heading2, Heading3,
    List, ListOrdered,
    AlignLeft, AlignCenter, AlignRight, AlignJustify,
    Undo, Redo, Columns2
} from 'lucide-react';
import './RichTextEditor.css';

const MenuBar = ({ editor }) => {
    if (!editor) {
        return null;
    }

    const insertDualApprovalBlock = () => {
        editor.chain().focus().insertContent(`
            <p></p>
            <table>
                <tbody>
                    <tr>
                        <td>
                            <p><strong>ТАЛ А / БАТЛАВ:</strong></p>
                            <p>Нэр: ____________________</p>
                            <p>Албан тушаал: ____________________</p>
                            <p>Гарын үсэг: ____________________</p>
                        </td>
                        <td>
                            <p><strong>ТАЛ Б / БАТЛАВ:</strong></p>
                            <p>Нэр: ____________________</p>
                            <p>Албан тушаал: ____________________</p>
                            <p>Гарын үсэг: ____________________</p>
                        </td>
                    </tr>
                </tbody>
            </table>
            <p></p>
        `).run();
    };

    return (
        <div className="rich-text-menubar">
            <div className="button-group">
                <button
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    disabled={!editor.can().chain().focus().toggleBold().run()}
                    className={editor.isActive('bold') ? 'is-active' : ''}
                    title="Bold"
                >
                    <Bold size={18} />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    disabled={!editor.can().chain().focus().toggleItalic().run()}
                    className={editor.isActive('italic') ? 'is-active' : ''}
                    title="Italic"
                >
                    <Italic size={18} />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    className={editor.isActive('underline') ? 'is-active' : ''}
                    title="Underline"
                >
                    <UnderlineIcon size={18} />
                </button>
            </div>

            <div className="divider" />

            <div className="button-group">
                <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}
                    title="Heading 1"
                >
                    <Heading1 size={18} />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
                    title="Heading 2"
                >
                    <Heading2 size={18} />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}
                    title="Heading 3"
                >
                    <Heading3 size={18} />
                </button>
            </div>

            <div className="divider" />

            <div className="button-group">
                <button
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={editor.isActive('bulletList') ? 'is-active' : ''}
                    title="Bullet List"
                >
                    <List size={18} />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={editor.isActive('orderedList') ? 'is-active' : ''}
                    title="Ordered List"
                >
                    <ListOrdered size={18} />
                </button>
            </div>

            <div className="divider" />

            <div className="button-group">
                <button
                    onClick={() => editor.chain().focus().setTextAlign('left').run()}
                    className={editor.isActive({ textAlign: 'left' }) ? 'is-active' : ''}
                    title="Align Left"
                >
                    <AlignLeft size={18} />
                </button>
                <button
                    onClick={() => editor.chain().focus().setTextAlign('center').run()}
                    className={editor.isActive({ textAlign: 'center' }) ? 'is-active' : ''}
                    title="Align Center"
                >
                    <AlignCenter size={18} />
                </button>
                <button
                    onClick={() => editor.chain().focus().setTextAlign('right').run()}
                    className={editor.isActive({ textAlign: 'right' }) ? 'is-active' : ''}
                    title="Align Right"
                >
                    <AlignRight size={18} />
                </button>
                <button
                    onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                    className={editor.isActive({ textAlign: 'justify' }) ? 'is-active' : ''}
                    title="Justify"
                >
                    <AlignJustify size={18} />
                </button>
            </div>

            <div className="divider" />

            <div className="button-group">
                <button
                    type="button"
                    onClick={insertDualApprovalBlock}
                    title="2 баганатай батлах хэсэг оруулах"
                >
                    <Columns2 size={16} />
                    <span className="toolbar-button-text">Батлах 2 багана</span>
                </button>
            </div>

            <div className="divider" />

            <div className="button-group">
                <button
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().chain().focus().undo().run()}
                    title="Undo"
                >
                    <Undo size={18} />
                </button>
                <button
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().chain().focus().redo().run()}
                    title="Redo"
                >
                    <Redo size={18} />
                </button>
            </div>
        </div>
    );
};

const RichTextEditor = ({ content, onChange, placeholder = 'Start typing...', editable = true }) => {
    const extensions = React.useMemo(() => [
        StarterKit,
        TextAlign.configure({
            types: ['heading', 'paragraph'],
        }),
        Table.configure({
            resizable: false
        }),
        TableRow,
        TableHeader,
        TableCell,
        Placeholder.configure({
            placeholder: placeholder,
        }),
    ], [placeholder]);

    const editor = useEditor({
        extensions,
        content: content,
        editable: editable,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
    });

    // Update content if it changes externally
    React.useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            // Keep editor in sync with parent state so AI-mapped placeholders are visible immediately.
            editor.commands.setContent(content || '<p></p>');
        }
    }, [content, editor]);

    return (
        <div className="rich-text-editor">
            <MenuBar editor={editor} />
            <div className="editor-content-wrapper">
                <EditorContent editor={editor} />
            </div>
        </div>
    );
};

export default RichTextEditor;
