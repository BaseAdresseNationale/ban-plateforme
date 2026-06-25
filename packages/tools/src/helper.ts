import type {Response} from 'express'

interface ApiResponseBody<TResponse = unknown> {
  date: Date
  status: 'success' | 'error'
  message: string
  response: TResponse
}

export const handleApiResponse = <TResponse>(
  res: Response,
  status: number,
  message: string,
  response: TResponse
) => {
  res.status(status).json({
    date: new Date(),
    status: status >= 200 && status < 300 ? 'success' : 'error',
    message,
    response,
  } satisfies ApiResponseBody<TResponse>)
}
