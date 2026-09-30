import { withPayload } from '@payloadcms/next/withPayload'
/** @type {import('next').NextConfig} */
const nextConfig = {
  // The ingest image model runs natively (onnxruntime) — keep it out of the bundler.
  serverExternalPackages: ['@huggingface/transformers', 'onnxruntime-node'],
}
export default withPayload(nextConfig)
