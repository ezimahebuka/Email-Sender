"use client";

import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Extension, Node } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { NodeSelection } from "@tiptap/pm/state";

type EmailButtonAttributes = {
  href: string;
  label: string;
  backgroundColor: string;
  textColor: string;
};

const DEFAULT_BUTTON: EmailButtonAttributes = {
  href: "https://",
  label: "Visit Our Website",
  backgroundColor: "#236a53",
  textColor: "#ffffff",
};

function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const EmailButton = Node.create({
  name: "emailButton",
  inline: true,
  group: "inline",
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      href: { default: "https://", parseHTML: (element) => element.getAttribute("href") },
      label: { default: "Visit Our Website", parseHTML: (element) => element.textContent },
      backgroundColor: { default: "#236a53", parseHTML: (element) => element.getAttribute("data-button-bg") },
      textColor: { default: "#ffffff", parseHTML: (element) => element.getAttribute("data-button-text") },
    };
  },
  parseHTML() {
    return [{ tag: 'a[data-email-button="true"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    const href = safeHttpUrl(String(HTMLAttributes.href ?? "")) ?? "https://";
    const label = String(HTMLAttributes.label ?? DEFAULT_BUTTON.label).slice(0, 100);
    const backgroundColor = /^#[\da-f]{6}$/i.test(HTMLAttributes.backgroundColor)
      ? HTMLAttributes.backgroundColor
      : DEFAULT_BUTTON.backgroundColor;
    const textColor = /^#[\da-f]{6}$/i.test(HTMLAttributes.textColor)
      ? HTMLAttributes.textColor
      : DEFAULT_BUTTON.textColor;

    return [
      "a",
      {
        href,
        "data-email-button": "true",
        "data-button-bg": backgroundColor,
        "data-button-text": textColor,
        target: "_blank",
        rel: "noopener noreferrer",
        style: `display:inline-block;background-color:${backgroundColor};color:${textColor};padding:12px 20px;border-radius:4px;text-decoration:none;font-weight:700;`,
      },
      label,
    ];
  },
});

const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [{
      types: ["textStyle"],
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (element: HTMLElement) => element.style.fontSize || null,
          renderHTML: (attributes: { fontSize?: string | null }) =>
            attributes.fontSize ? { style: `font-size:${attributes.fontSize}` } : {},
        },
      },
    }];
  },
});

type EmailEditorProps = {
  value: string;
  onChange: (html: string, text: string) => void;
  disabled?: boolean;
};

type ButtonDialog = EmailButtonAttributes & { editing: boolean };

export default function EmailEditor({ value, onChange, disabled = false }: EmailEditorProps) {
  const [dialog, setDialog] = useState<ButtonDialog | null>(null);
  const [dialogError, setDialogError] = useState("");
  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({ link: false, underline: false }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
        isAllowedUri: (url) => Boolean(safeHttpUrl(url)) || url.startsWith("mailto:"),
      }),
      Placeholder.configure({ placeholder: "Write your message here..." }),
      FontSize,
      EmailButton,
    ],
    content: value || "<p></p>",
    onUpdate: ({ editor: current }) => onChange(current.getHTML(), current.getText()),
    editorProps: {
      attributes: {
        class: "message-input rich-editor-content",
        "aria-label": "Email Message",
      },
      handleClickOn: (view, _position, node, nodePosition, _event, direct) => {
        if (direct && node.type.name === "emailButton") {
          const selection = NodeSelection.create(view.state.doc, nodePosition);
          view.dispatch(view.state.tr.setSelection(selection));
          return true;
        }
        return false;
      },
    },
  });

  useEffect(() => {
    if (editor) editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (editor && value && value !== editor.getHTML()) editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  if (!editor) return <div className="rich-editor-loading" aria-label="Loading message editor" />;
  const activeEditor = editor;

  function setLink() {
    const existing = activeEditor.getAttributes("link").href as string | undefined;
    const href = window.prompt("Enter a web address (https:// or http://)", existing ?? "https://");
    if (href === null) return;
    if (!safeHttpUrl(href) && !href.startsWith("mailto:")) {
      setDialogError("Use a valid http:// or https:// link.");
      return;
    }
    setDialogError("");
    activeEditor.chain().focus().setLink({ href }).run();
  }

  function editButton() {
    const selection = activeEditor.state.selection;
    const node = selection instanceof NodeSelection
      ? selection.node as typeof selection.node & { attrs: EmailButtonAttributes }
      : undefined;
    const isButton = node?.type.name === "emailButton";
    setDialog({
      ...(isButton ? node.attrs : DEFAULT_BUTTON),
      editing: Boolean(isButton),
    });
    setDialogError("");
  }

  function saveButton() {
    if (!dialog) return;
    const href = safeHttpUrl(dialog.href);
    if (!href) {
      setDialogError("Enter a valid http:// or https:// destination.");
      return;
    }
    if (!dialog.label.trim()) {
      setDialogError("Enter button text.");
      return;
    }
    const attributes = {
      href,
      label: dialog.label.trim().slice(0, 100),
      backgroundColor: dialog.backgroundColor,
      textColor: dialog.textColor,
    };
    if (dialog.editing) {
      activeEditor.chain().focus().updateAttributes("emailButton", attributes).run();
    } else {
      activeEditor.chain().focus().insertContent({ type: "emailButton", attrs: attributes }).run();
    }
    setDialog(null);
  }

  const activeButton = editor.isActive("emailButton");
  const toolbarButton = (
    label: string,
    action: () => void,
    active = false,
    disabledAction = false,
  ) => (
    <button
      key={label}
      className={`editor-tool ${active ? "active" : ""}`}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled || disabledAction}
      onMouseDown={(event) => event.preventDefault()}
      onClick={action}
    >
      {label}
    </button>
  );

  return (
    <div className="rich-editor" aria-label="Email message editor">
      <div className="editor-toolbar" role="toolbar" aria-label="Message formatting">
        {toolbarButton("B", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}
        {toolbarButton("I", () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"))}
        {toolbarButton("U", () => editor.chain().focus().toggleUnderline().run(), editor.isActive("underline"))}
        {toolbarButton("S", () => editor.chain().focus().toggleStrike().run(), editor.isActive("strike"))}
        <span className="toolbar-divider" />
        <label className="editor-select-label" title="Font size">
          <span className="visually-hidden">Font size</span>
          <select
            aria-label="Font size"
            value={editor.getAttributes("textStyle").fontSize ?? ""}
            disabled={disabled}
            onChange={(event) => {
              const chain = editor.chain().focus();
              if (event.target.value) {
                chain.setMark("textStyle", { fontSize: event.target.value }).run();
              } else {
                chain.setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run();
              }
            }}
          >
            <option value="">Size</option>
            <option value="12px">12</option>
            <option value="14px">14</option>
            <option value="16px">16</option>
            <option value="18px">18</option>
            <option value="24px">24</option>
            <option value="32px">32</option>
          </select>
        </label>
        <label className="editor-color-tool" title="Text color">
          <span>A</span><input aria-label="Text color" type="color" defaultValue="#202a29" disabled={disabled} onChange={(event) => editor.chain().focus().setColor(event.target.value).run()} />
        </label>
        <label className="editor-color-tool highlight-tool" title="Highlight color">
          <span>▰</span><input aria-label="Highlight color" type="color" defaultValue="#fff09b" disabled={disabled} onChange={(event) => editor.chain().focus().toggleHighlight({ color: event.target.value }).run()} />
        </label>
        <span className="toolbar-divider" />
        {toolbarButton("• List", () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"))}
        {toolbarButton("1. List", () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"))}
        {toolbarButton("Left", () => editor.chain().focus().setTextAlign("left").run(), editor.isActive({ textAlign: "left" }))}
        {toolbarButton("Center", () => editor.chain().focus().setTextAlign("center").run(), editor.isActive({ textAlign: "center" }))}
        {toolbarButton("Right", () => editor.chain().focus().setTextAlign("right").run(), editor.isActive({ textAlign: "right" }))}
        <span className="toolbar-divider" />
        {toolbarButton("Link", setLink, editor.isActive("link"))}
        {toolbarButton("Insert Button", editButton, activeButton)}
        {activeButton && toolbarButton("Remove Button", () => editor.chain().focus().deleteSelection().run())}
        {toolbarButton("Undo", () => editor.chain().focus().undo().run(), false, !editor.can().undo())}
        {toolbarButton("Redo", () => editor.chain().focus().redo().run(), false, !editor.can().redo())}
        {toolbarButton("Clear", () => editor.chain().focus().clearNodes().unsetAllMarks().run())}
      </div>
      <EditorContent editor={editor} />

      {dialog && (
        <div className="modal-backdrop editor-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setDialog(null);
        }}>
          <section className="confirm-dialog button-dialog" role="dialog" aria-modal="true" aria-labelledby="button-dialog-title">
            <p className="eyebrow"><span className="status-dot" /> EMAIL BUTTON</p>
            <h2 id="button-dialog-title">{dialog.editing ? "Edit button" : "Insert button"}</h2>
            <label className="dialog-field">Button text
              <input autoFocus maxLength={100} value={dialog.label} onChange={(event) => setDialog({ ...dialog, label: event.target.value })} />
            </label>
            <label className="dialog-field">Destination URL
              <input type="url" placeholder="https://example.com" value={dialog.href} onChange={(event) => setDialog({ ...dialog, href: event.target.value })} />
            </label>
            <div className="button-color-row">
              <label className="dialog-field">Background color<input aria-label="Button background color" type="color" value={dialog.backgroundColor} onChange={(event) => setDialog({ ...dialog, backgroundColor: event.target.value })} /></label>
              <label className="dialog-field">Text color<input aria-label="Button text color" type="color" value={dialog.textColor} onChange={(event) => setDialog({ ...dialog, textColor: event.target.value })} /></label>
            </div>
            {dialogError && <p className="notice error-notice" role="alert">{dialogError}</p>}
            <div className="dialog-actions">
              <button type="button" className="cancel-button" onClick={() => setDialog(null)}>Cancel</button>
              <button type="button" className="send-button" onClick={saveButton}>{dialog.editing ? "Save button" : "Insert button"}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}