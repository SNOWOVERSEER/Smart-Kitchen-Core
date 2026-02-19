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
      toast.success('Item added')
    },
    onError: () => toast.error('Failed to add item'),
  })
}

export function useUpdateBatch() {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateInventoryRequest }) => updateBatch(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: INVENTORY_KEY })
      toast.success('Batch updated')
    },
    onError: () => toast.error('Failed to update batch'),
  })
}

export function useDeleteBatch() {
  return useMutation({
    mutationFn: (id: number) => deleteBatch(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: INVENTORY_KEY })
      toast.success('Batch removed')
    },
    onError: () => toast.error('Failed to remove batch'),
  })
}

export function useConsumeItem() {
  return useMutation({
    mutationFn: (data: ConsumeRequest) => consumeItem(data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: INVENTORY_KEY })
      toast.success(result.message)
    },
    onError: () => toast.error('Failed to consume item'),
  })
}
