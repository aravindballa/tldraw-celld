interface Env {
	TLDRAW_DURABLE_OBJECT: DurableObjectNamespace<import('./TldrawDurableObject').TldrawDurableObject>
	TLDRAW_BUCKET: R2Bucket
}
