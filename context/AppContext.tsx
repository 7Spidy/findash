'use client'

import { createContext, useContext, useReducer, type ReactNode } from 'react'
import type { AppState, RawStatement, ParsedStatement, AIInsight } from '@/types'

type Action =
  | { type: 'ADD_RAW_STATEMENT'; payload: RawStatement }
  | { type: 'REMOVE_STATEMENT'; payload: number }
  | { type: 'SET_ANALYSIS_STATUS'; payload: AppState['analysis_status'] }
  | { type: 'SET_PARSED_DATA'; payload: { parsed_statements: ParsedStatement[]; insights: AIInsight[] } }
  | { type: 'UPDATE_TRANSACTION'; payload: { statement_id: string; txn_id: string; category?: string; subcategory?: string; notes?: string } }
  | { type: 'DISMISS_INSIGHT'; payload: string }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'RESET' }

const initialState: AppState = {
  raw_statements: [],
  parsed_statements: [],
  insights: [],
  analysis_status: 'idle',
  error_message: '',
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_RAW_STATEMENT':
      return { ...state, raw_statements: [...state.raw_statements, action.payload] }

    case 'REMOVE_STATEMENT':
      return {
        ...state,
        raw_statements: state.raw_statements.filter((_, i) => i !== action.payload),
      }

    case 'SET_ANALYSIS_STATUS':
      return { ...state, analysis_status: action.payload }

    case 'SET_PARSED_DATA':
      return {
        ...state,
        parsed_statements: action.payload.parsed_statements,
        insights: action.payload.insights,
        analysis_status: 'done',
      }

    case 'UPDATE_TRANSACTION':
      return {
        ...state,
        parsed_statements: state.parsed_statements.map((stmt) => {
          if (stmt.id !== action.payload.statement_id) return stmt
          return {
            ...stmt,
            transactions: stmt.transactions.map((txn) => {
              if (txn.id !== action.payload.txn_id) return txn
              return {
                ...txn,
                ...(action.payload.category !== undefined && { category: action.payload.category, category_source: 'manual' as const }),
                ...(action.payload.subcategory !== undefined && { subcategory: action.payload.subcategory }),
                ...(action.payload.notes !== undefined && { notes: action.payload.notes }),
              }
            }),
          }
        }),
      }

    case 'DISMISS_INSIGHT':
      return {
        ...state,
        insights: state.insights.map((ins) =>
          ins.id === action.payload ? { ...ins, dismissed: true } : ins
        ),
      }

    case 'SET_ERROR':
      return { ...state, analysis_status: 'error', error_message: action.payload }

    case 'RESET':
      return initialState

    default:
      return state
  }
}

const AppContext = createContext<{
  state: AppState
  dispatch: React.Dispatch<Action>
} | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>
}

export function useAppState() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppState must be used inside AppProvider')
  return ctx
}
