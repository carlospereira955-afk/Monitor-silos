import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  widthClass?: string
}

export function Modal({ title, onClose, children, widthClass = 'max-w-md' }: ModalProps) {
  // Renderizado via portal diretamente no <body>: qualquer antepassado com
  // backdrop-filter/filter/transform (ex.: o cabeçalho, que usa
  // backdrop-blur) cria um novo "containing block" em CSS para elementos
  // "position: fixed" — sem o portal, o modal passava a posicionar-se em
  // relação a esse antepassado (uns 60px de altura) em vez do ecrã
  // inteiro, cortando o cabeçalho do modal fora da vista em ecrãs pequenos.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`flex w-full ${widthClass} max-h-[90vh] flex-col rounded-xl border border-slate-800 bg-slate-900 shadow-xl`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Cabeçalho fixo: fica sempre visível, mesmo quando o conteúdo
            abaixo (ex.: opções avançadas, mensagens de erro) obriga a
            fazer scroll dentro do modal — sem isto, em ecrãs pequenos,
            o título e o botão de fechar desapareciam ao fazer scroll. */}
        <div className="flex shrink-0 items-center justify-between rounded-t-xl border-b border-slate-800 bg-slate-900 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
