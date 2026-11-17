# Estructuras de datos

Implementadas a mano en `src/structures/`, con pruebas en `tests/structures/`, y usadas por la lógica real.

| Estructura | Complejidad clave | Archivo | Dónde se usa |
| --- | --- | --- | --- |
| Lista enlazada | append/prepend/removeFirst O(1) | `LinkedList.ts` | Base de `Queue` |
| Lista doblemente enlazada | navegación prev/next O(1) | `DoublyLinkedList.ts` | `SeizuresService.getWithNavigation` |
| Pila | push/pop O(1) | `Stack.ts` | `DailyLogsService.undoLast` |
| Cola | enqueue/dequeue O(1) | `Queue.ts` | Cola de envíos en `EmergencyService` |
| Montículo mínimo | push/pop O(log n) | `MinHeap.ts` | `PriorityQueue`, top-k en IA local |
| Cola de prioridad estable | O(log n) | `PriorityQueue.ts` | Contactos por prioridad en emergencias |
| Buffer circular | push O(1), sin realocar | `CircularBuffer.ts` | Ventana en vivo de wearables |
| Tabla hash (FNV-1a, encadenamiento) | O(1) amortizado | `HashTable.ts` | Intentos de login, buffers por usuario, enfriamiento |
| Árbol binario de búsqueda | O(h), rangos | `BinarySearchTree.ts` | Índice por fecha del registro diario |
| Árbol AVL | O(log n), rangos O(log n + m) | `AVLTree.ts` | Índice de crisis por fecha |
| Trie | O(L) por prefijo | `Trie.ts` | Autocompletado de medicamentos |
| Grafo ponderado | BFS/DFS O(V+E), PageRank | `Graph.ts` | Co-ocurrencia de desencadenantes |
| Caché LRU con TTL | get/set O(1) | `LRUCache.ts` | Índices, riesgo, `CachedTable` |
| Filtro de Bloom | O(k), sin falsos negativos | `BloomFilter.ts` | Correos y tokens revocados |
| Árbol de Fenwick | O(log n) | `FenwickTree.ts` | Sumas por rango (adherencia, informe) |
| Árbol de segmentos | O(log n) | `SegmentTree.ts` | Mínimo de sueño por rango (informe) |

## Patrones de diseño (`src/patterns/`)

- **Singleton**: `ConfigProvider` (configuración) y `Database` (pool de PostgreSQL, en `src/db`).
- **Factory**: `NotificationChannelFactory` crea el canal (email, sms, push, log).
- **Builder**: `MedicalReportBuilder` construye el informe médico por secciones.
- **Prototype**: `DailyLogTemplate.clone()` para plantillas de registro.
- **Proxy**: `CachedTable` intercepta `get` con una caché LRU y la invalida en escrituras.
