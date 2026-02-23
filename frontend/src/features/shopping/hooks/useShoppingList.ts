import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  getShoppingList,
  addShoppingItem,
  addShoppingItemsBulk,
  updateShoppingItem,
  deleteShoppingItem,
  deleteCheckedItems,
  completeShopping,
} from '@/features/shopping/api'
import type {
  ShoppingItemCreate,
  ShoppingItemUpdate,
  CompleteShoppingRequest,
} from '@/shared/lib/api.types'

const SHOPPING_KEY = ['shopping'] as const

export function useShoppingList() {
  return useQuery({ queryKey: SHOPPING_KEY, queryFn: getShoppingList })
}

export function useAddShoppingItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (item: ShoppingItemCreate) => addShoppingItem(item),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: SHOPPING_KEY })
    },
  })
}

export function useAddShoppingItemsBulk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (items: ShoppingItemCreate[]) => addShoppingItemsBulk(items),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: SHOPPING_KEY })
      toast.success(`${data.length} items added to shopping list`)
    },
  })
}

export function useToggleShoppingItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, is_checked }: { id: number; is_checked: boolean }) =>
      updateShoppingItem(id, { is_checked }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: SHOPPING_KEY })
    },
  })
}

export function useUpdateShoppingItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, update }: { id: number; update: ShoppingItemUpdate }) =>
      updateShoppingItem(id, update),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: SHOPPING_KEY })
    },
  })
}

export function useDeleteShoppingItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteShoppingItem(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: SHOPPING_KEY })
    },
  })
}

export function useDeleteCheckedItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteCheckedItems,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: SHOPPING_KEY })
    },
  })
}

export function useCompleteShopping() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (req: CompleteShoppingRequest) => completeShopping(req),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: SHOPPING_KEY })
      void qc.invalidateQueries({ queryKey: ['inventory'] })
      toast.success(`${data.added_count} items added to inventory`)
    },
    onError: () => toast.error('Some items could not be added'),
  })
}
