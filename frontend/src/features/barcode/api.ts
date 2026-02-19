import { apiClient } from '@/shared/lib/axios'
import type { BarcodeResponse } from '@/shared/lib/api.types'

export async function lookupBarcode(code: string): Promise<BarcodeResponse> {
  const response = await apiClient.get<BarcodeResponse>(`/api/v1/barcode/${code}`)
  return response.data
}
