import { error, IRequest } from 'itty-router'

function getAssetObjectName(uploadId: string) {
	return `uploads/${uploadId.replace(/[^a-zA-Z0-9_-]+/g, '_')}`
}

// only image and video uploads are allowed
export async function handleAssetUpload(request: IRequest, env: Env) {
	const objectName = getAssetObjectName(request.params.uploadId)

	const contentType = request.headers.get('content-type') ?? ''
	if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
		return error(400, 'Invalid content type')
	}

	if (await env.TLDRAW_BUCKET.head(objectName)) {
		return error(409, 'Upload already exists')
	}

	await env.TLDRAW_BUCKET.put(objectName, request.body, {
		httpMetadata: { contentType },
	})

	return { ok: true }
}

// celld has no edge cache (caches.default always misses), so we rely on
// immutable cache headers + etags for browser caching.
export async function handleAssetDownload(request: IRequest, env: Env) {
	const objectName = getAssetObjectName(request.params.uploadId)

	const object = await env.TLDRAW_BUCKET.get(objectName, {
		range: request.headers,
		onlyIf: request.headers,
	})

	if (!object) {
		return error(404)
	}

	const headers = new Headers()
	object.writeHttpMetadata(headers)
	headers.set('cache-control', 'public, max-age=31536000, immutable')
	headers.set('etag', object.httpEtag)
	headers.set('accept-ranges', 'bytes')
	headers.set('access-control-allow-origin', '*')

	// Prevent XSS from user-uploaded SVGs (or any file served with an executable content-type).
	headers.set('content-security-policy', "default-src 'none'")
	headers.set('x-content-type-options', 'nosniff')

	const contentRange = getContentRange(object)
	if (contentRange) {
		headers.set('content-range', contentRange)
	}

	const body = 'body' in object && object.body ? object.body : null
	const status = body ? (contentRange ? 206 : 200) : 304

	return new Response(body, { headers, status })
}

function getContentRange(object: R2Object) {
	if (!object.range) return undefined
	if ('suffix' in object.range) {
		const start = object.size - object.range.suffix
		return `bytes ${start}-${object.size - 1}/${object.size}`
	}
	const start = object.range.offset ?? 0
	const end = object.range.length ? start + object.range.length - 1 : object.size - 1
	if (start === 0 && end === object.size - 1) return undefined
	return `bytes ${start}-${end}/${object.size}`
}
