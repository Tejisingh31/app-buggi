/**
 * Parti dell'API "File System Access" che TypeScript non conosce ancora.
 * Esistono solo in alcuni browser (Chrome/Edge su computer): il codice controlla sempre prima di usarle.
 */
interface FileSystemHandle {
  queryPermission?(descrittore?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(descrittore?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
}

interface Window {
  showDirectoryPicker?(opzioni?: { id?: string; mode?: 'read' | 'readwrite'; startIn?: string }): Promise<FileSystemDirectoryHandle>;
}
