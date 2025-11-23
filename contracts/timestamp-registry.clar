;; title: timestamp-registry
;; version: 1.0.0
;; summary: Core contract for immutable document timestamping on Stacks blockchain
;; description: Manages registration, storage, and verification of cryptographic timestamps
;;              for digital documents. Each timestamp is anchored to Bitcoin through Stacks PoX.

;; Constants
;; Error codes following Clarity best practices
(define-constant ERR-UNAUTHORIZED (err u100))
(define-constant ERR-ALREADY-EXISTS (err u101))
(define-constant ERR-NOT-FOUND (err u102))
(define-constant ERR-INVALID-HASH (err u103))
(define-constant ERR-INVALID-URI (err u104))
(define-constant ERR-INVALID-METADATA (err u105))

;; Contract owner for administrative functions
(define-constant CONTRACT-OWNER tx-sender)

;; Maximum URI length (256 ASCII characters)
(define-constant MAX-URI-LENGTH u256)

;; Data Variables
;; Counter for total timestamps registered
(define-data-var total-timestamps uint u0)

;; Data Maps
;; Primary timestamp registry mapping document hash to timestamp record
(define-map timestamps
  { hash: (buff 32) }
  {
    owner: principal,
    timestamp: uint,
    block-height: uint,
    tx-id: (buff 32),
    metadata-hash: (buff 32),
    proof-uri: (string-ascii 256),
    is-active: bool
  }
)

;; Verification cache for optimizing repeated verifications
(define-map verification-cache
  { hash: (buff 32) }
  {
    verified: bool,
    verification-time: uint,
    verifier: principal
  }
)

;; Track all timestamps created by a specific owner
(define-map owner-timestamps
  { owner: principal, index: uint }
  { hash: (buff 32) }
)

;; Track timestamp count per owner
(define-map owner-timestamp-count
  { owner: principal }
  { count: uint }
)

;; Public Functions

;; Register a new timestamp for a document hash
;; @param document-hash: SHA-256 hash of the document (32 bytes)
;; @param metadata-hash: Hash of document metadata (32 bytes)
;; @param proof-uri: IPFS or external URI for proof storage
;; @returns: (response bool uint) Success with timestamp block height
(define-public (register-timestamp 
    (document-hash (buff 32))
    (metadata-hash (buff 32))
    (proof-uri (string-ascii 256))
  )
  (let
    (
      (caller tx-sender)
      (current-block stacks-block-height)
      (current-time burn-block-height)
      (tx-hash 0x0000000000000000000000000000000000000000000000000000000000000000)
    )
    ;; Validate inputs
    (asserts! (is-valid-hash document-hash) ERR-INVALID-HASH)
    (asserts! (is-valid-hash metadata-hash) ERR-INVALID-METADATA)
    (asserts! (is-valid-uri proof-uri) ERR-INVALID-URI)
    
    ;; Check if timestamp already exists
    (asserts! (is-none (map-get? timestamps { hash: document-hash })) ERR-ALREADY-EXISTS)
    
    ;; Store timestamp record
    (map-set timestamps
      { hash: document-hash }
      {
        owner: caller,
        timestamp: current-time,
        block-height: current-block,
        tx-id: tx-hash,
        metadata-hash: metadata-hash,
        proof-uri: proof-uri,
        is-active: true
      }
    )
    
    ;; Update owner tracking
    (update-owner-timestamp-tracking caller document-hash)
    
    ;; Increment total timestamps counter
    (var-set total-timestamps (+ (var-get total-timestamps) u1))
    
    ;; Emit event via print
    (print {
      event: "timestamp-registered",
      hash: document-hash,
      owner: caller,
      block-height: current-block,
      timestamp: current-time
    })
    
    (ok current-block)
  )
)

;; Verify a document timestamp
;; @param document-hash: Hash to verify
;; @returns: (response (optional timestamp-record) uint) Timestamp record if found
(define-public (verify-timestamp (document-hash (buff 32)))
  (let
    (
      (timestamp-data (map-get? timestamps { hash: document-hash }))
      (current-block stacks-block-height)
      (current-time burn-block-height)
    )
    ;; Validate hash
    (asserts! (is-valid-hash document-hash) ERR-INVALID-HASH)
    
    ;; Check if timestamp exists
    (asserts! (is-some timestamp-data) ERR-NOT-FOUND)
    
    ;; Cache verification result
    (map-set verification-cache
      { hash: document-hash }
      {
        verified: true,
        verification-time: current-time,
        verifier: tx-sender
      }
    )
    
    ;; Emit verification event
    (print {
      event: "timestamp-verified",
      hash: document-hash,
      verifier: tx-sender,
      verification-time: current-time
    })
    
    (ok timestamp-data)
  )
)

;; Update timestamp URI (only by owner)
;; @param document-hash: Hash of the document
;; @param new-proof-uri: New proof URI
;; @returns: (response bool uint)
(define-public (update-proof-uri
    (document-hash (buff 32))
    (new-proof-uri (string-ascii 256))
  )
  (let
    (
      (timestamp-data (unwrap! (map-get? timestamps { hash: document-hash }) ERR-NOT-FOUND))
    )
    ;; Only owner can update
    (asserts! (is-eq tx-sender (get owner timestamp-data)) ERR-UNAUTHORIZED)
    
    ;; Validate new URI
    (asserts! (is-valid-uri new-proof-uri) ERR-INVALID-URI)
    
    ;; Update the URI
    (map-set timestamps
      { hash: document-hash }
      (merge timestamp-data { proof-uri: new-proof-uri })
    )
    
    (print {
      event: "proof-uri-updated",
      hash: document-hash,
      new-uri: new-proof-uri
    })
    
    (ok true)
  )
)

;; Deactivate a timestamp (soft delete, maintains on-chain record)
;; @param document-hash: Hash to deactivate
;; @returns: (response bool uint)
(define-public (deactivate-timestamp (document-hash (buff 32)))
  (let
    (
      (timestamp-data (unwrap! (map-get? timestamps { hash: document-hash }) ERR-NOT-FOUND))
    )
    ;; Only owner can deactivate
    (asserts! (is-eq tx-sender (get owner timestamp-data)) ERR-UNAUTHORIZED)
    
    ;; Update active status
    (map-set timestamps
      { hash: document-hash }
      (merge timestamp-data { is-active: false })
    )
    
    (print {
      event: "timestamp-deactivated",
      hash: document-hash,
      owner: tx-sender
    })
    
    (ok true)
  )
)

;; Read-Only Functions

;; Get timestamp record for a document hash
;; @param document-hash: Hash to query
;; @returns: (optional timestamp-record)
(define-read-only (get-timestamp (document-hash (buff 32)))
  (map-get? timestamps { hash: document-hash })
)

;; Get verification cache entry
;; @param document-hash: Hash to query
;; @returns: (optional verification-record)
(define-read-only (get-verification-cache (document-hash (buff 32)))
  (map-get? verification-cache { hash: document-hash })
)

;; Get total number of timestamps registered
;; @returns: uint Total count
(define-read-only (get-total-timestamps)
  (var-get total-timestamps)
)

;; Check if a timestamp exists and is active
;; @param document-hash: Hash to check
;; @returns: bool True if exists and active
(define-read-only (is-timestamp-active (document-hash (buff 32)))
  (match (map-get? timestamps { hash: document-hash })
    timestamp-data (get is-active timestamp-data)
    false
  )
)

;; Get timestamp count for an owner
;; @param owner: Principal to query
;; @returns: uint Count of timestamps
(define-read-only (get-owner-timestamp-count (owner principal))
  (default-to u0
    (get count (map-get? owner-timestamp-count { owner: owner }))
  )
)

;; Get specific timestamp hash by owner and index
;; @param owner: Owner principal
;; @param index: Index in owner's timestamp list
;; @returns: (optional buff) Document hash
(define-read-only (get-owner-timestamp-by-index (owner principal) (index uint))
  (get hash (map-get? owner-timestamps { owner: owner, index: index }))
)

;; Get timestamp metadata (owner, time, block height)
;; @param document-hash: Hash to query
;; @returns: (optional tuple) Metadata tuple
(define-read-only (get-timestamp-metadata (document-hash (buff 32)))
  (match (map-get? timestamps { hash: document-hash })
    timestamp-data (some {
      owner: (get owner timestamp-data),
      timestamp: (get timestamp timestamp-data),
      block-height: (get block-height timestamp-data),
      is-active: (get is-active timestamp-data)
    })
    none
  )
)

;; Private Functions

;; Validate that a hash is non-zero (basic validation)
;; @param hash: Hash to validate
;; @returns: bool True if valid
(define-private (is-valid-hash (hash (buff 32)))
  ;; Hash must not be all zeros
  (not (is-eq hash 0x0000000000000000000000000000000000000000000000000000000000000000))
)

;; Validate URI is non-empty
;; @param uri: URI to validate
;; @returns: bool True if valid
(define-private (is-valid-uri (uri (string-ascii 256)))
  (> (len uri) u0)
)

;; Update owner timestamp tracking
;; @param owner: Owner principal
;; @param hash: Document hash
;; @returns: bool Success
(define-private (update-owner-timestamp-tracking (owner principal) (hash (buff 32)))
  (let
    (
      (current-count (get-owner-timestamp-count owner))
    )
    ;; Store hash at current index
    (map-set owner-timestamps
      { owner: owner, index: current-count }
      { hash: hash }
    )
    
    ;; Increment owner's count
    (map-set owner-timestamp-count
      { owner: owner }
      { count: (+ current-count u1) }
    )
    
    true
  )
)

