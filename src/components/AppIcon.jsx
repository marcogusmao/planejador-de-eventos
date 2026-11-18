// Sistema de ícones da casa (guia GUIA-IMPLEMENTACAO-VISUAL-LINEAR, §11/§12,
// Sessão F2-T). Lucide é a biblioteca de ícones de AÇÃO/FUNÇÃO — exportar,
// buscar, editar, excluir, abas, cadeado. NÃO é para identidade de marca: as
// bolas pintadas (Bola em ui.jsx), o semáforo verde/amarelo/vermelho e o dot
// de cor por festa continuam sendo SVG próprio — são assinatura visual, não
// ícone de sistema (fronteira cravada pelo Marco).
//
// Tudo local: lucide-react é dependência npm vendorizada no bundle, nunca CDN.

import {
  Settings,
  ShieldCheck,
  Download,
  FileUp,
  Plus,
  ArrowLeft,
  CalendarDays,
  RefreshCw,
  Copy,
  FileText,
  Presentation,
  CircleCheck,
  TriangleAlert,
  ArrowUpRight,
  Trash2,
  Pencil,
  CircleDollarSign,
  Receipt,
  ChartNoAxesCombined,
  ChartColumn,
  ClipboardCheck,
  X,
  Eye,
  Printer,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Sun,
  Moon,
  FlaskConical,
  NotebookPen,
  Undo2,
  Redo2,
} from 'lucide-react'

export const ICON_SIZE = 16 // padrão de ação
export const ICON_SIZE_STATUS = 18 // destaque/status semântico
export const ICON_STROKE = 1.75

// Componente padrão: um único lugar decide tamanho e traço, para o app inteiro
// falar a mesma língua. `label` transforma um ícone decorativo em ícone com
// nome acessível (usar quando o ícone carrega significado sozinho, sem texto
// ao lado); sem `label`, o ícone é aria-hidden e o texto vizinho é quem nomeia.
export function AppIcon({ icon: Icon, size = ICON_SIZE, label, className = '', ...props }) {
  return (
    <Icon
      size={size}
      strokeWidth={ICON_STROKE}
      className={`inline-block shrink-0 ${className}`}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      {...props}
    />
  )
}

export {
  Settings,
  ShieldCheck,
  Download,
  FileUp,
  Plus,
  ArrowLeft,
  CalendarDays,
  RefreshCw,
  Copy,
  FileText,
  Presentation,
  CircleCheck,
  TriangleAlert,
  ArrowUpRight,
  Trash2,
  Pencil,
  CircleDollarSign,
  Receipt,
  ChartNoAxesCombined,
  ChartColumn,
  ClipboardCheck,
  X,
  Eye,
  Printer,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Sun,
  Moon,
  FlaskConical,
  NotebookPen,
  Undo2,
  Redo2,
}
