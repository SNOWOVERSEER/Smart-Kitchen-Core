import { useQuery, useMutation } from '@tanstack/react-query'
import { queryClient } from '@/shared/lib/queryClient'
import { getInventory, addInventoryItem, updateBatch, deleteBatch, consumeItem } from '../api'
import type { AddInventoryRequest, UpdateInventoryRequest, ConsumeRequest } from '@/shared/lib/api.types'
import toast from 'react-hot-toast'

const INVENTORY_KEY = ['inventory']

export function useInventory() {
  return useQuery({
    queryKey: INVENTORY_KEY,
    queryFn: getInventory,
  })
}

export function useAddItem() {
  return useMutation({
    mutationFn: (data: AddInventoryRequest) => addInventoryItem(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: INVENTORY_KEY })
      toast.success('Item added', { id: 'inventory-action' })
    },
    onError: () => toast.error('Failed to add item', { id: 'inventory-action' }),
  })
}

export function useUpdateBatch() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateInventoryRequest }) => updateBatch(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: INVENTORY_KEY })
      toast.success('Batch updated', { id: 'inventory-action' })
    },
    onError: () => toast.error('Failed to update batch', { id: 'inventory-action' }),
  })
}

export function useDeleteBatch() {
  return useMutation({
    mutationFn: (id: string) => deleteBatch(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: INVENTORY_KEY })
      toast.success('Batch removed', { id: 'inventory-action' })
    },
    onError: () => toast.error('Failed to remove batch', { id: 'inventory-action' }),
  })
}

export function useConsumeItem() {
  return useMutation({
    mutationFn: (data: ConsumeRequest) => consumeItem(data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: INVENTORY_KEY })
      toast.success(result.message, { id: 'inventory-action' })
    },
    onError: () => toast.error('Failed to consume item', { id: 'inventory-action' }),
  })
}
