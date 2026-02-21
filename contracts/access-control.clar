;; title: access-control
;; version: 1.0.0
;; summary: Access control and permission management for timestamp records
;; description: Manages granular permissions for timestamp access, allowing owners to grant
;;              and revoke access rights to other principals with role-based permissions.

;; Constants
;; Error codes
(define-constant ERR-UNAUTHORIZED (err u200))
(define-constant ERR-NOT-FOUND (err u201))
(define-constant ERR-ALREADY-GRANTED (err u202))
(define-constant ERR-INVALID-PERMISSION (err u203))
(define-constant ERR-INVALID-USER (err u204))
(define-constant ERR-SELF-GRANT (err u205))

;; Permission levels
(define-constant PERMISSION-NONE "none")
(define-constant PERMISSION-VIEWER "viewer")
(define-constant PERMISSION-EDITOR "editor")
(define-constant PERMISSION-ADMIN "admin")

;; Maximum users per timestamp (to prevent gas limit issues)
(define-constant MAX-USERS-PER-TIMESTAMP u100)

;; Data Variables
;; Total number of access grants
(define-data-var total-grants uint u0)

;; Data Maps
;; Primary access control map: tracks permissions for each user on each document hash
(define-map access-control
  { hash: (buff 32), user: principal }
  {
    permission: (string-ascii 10),
    granted-by: principal,
    granted-at: uint,
    granted-block: uint
  }
)

;; Track all users with access to a specific hash
(define-map hash-users
  { hash: (buff 32), index: uint }
  { user: principal }
)

;; Track user count per hash
(define-map hash-user-count
  { hash: (buff 32) }
  { count: uint }
)

;; Track all hashes a user has access to
(define-map user-accessible-hashes
  { user: principal, index: uint }
  { hash: (buff 32) }
)

;; Track hash count per user
(define-map user-hash-count
  { user: principal }
  { count: uint }
)

;; Timestamp ownership tracking (to verify grant authority)
(define-map timestamp-owners
  { hash: (buff 32) }
  { owner: principal }
)

;; Public Functions

;; Register timestamp ownership (called by timestamp-registry contract)
;; @param document-hash: Hash of the document
;; @param owner: Owner principal
;; @returns: (response bool uint)
(define-public (register-timestamp-owner (document-hash (buff 32)) (owner principal))
  ;; This would ideally be restricted to the timestamp-registry contract
  ;; For now, we allow any caller to register (in production, use contract-caller check)
  (begin
    (map-set timestamp-owners
      { hash: document-hash }
      { owner: owner }
    )
    (ok true)
  )
)

;; Grant access to a user for a specific document hash
;; @param document-hash: Hash to grant access to
;; @param user: Principal to grant access
;; @param permission: Permission level (viewer/editor/admin)
;; @returns: (response bool uint)
(define-public (grant-access
    (document-hash (buff 32))
    (user principal)
    (permission (string-ascii 10))
  )
  (let
    (
      (caller tx-sender)
      (owner-data (map-get? timestamp-owners { hash: document-hash }))
      (current-block stacks-block-height)
      (current-time burn-block-height)
      (user-count (get-hash-user-count document-hash))
    )
    ;; Validate inputs
    (asserts! (is-some owner-data) ERR-NOT-FOUND)
    (asserts! (is-valid-permission permission) ERR-INVALID-PERMISSION)
    
    ;; Prevent self-granting
    (asserts! (not (is-eq caller user)) ERR-SELF-GRANT)
    
    ;; Check authorization: caller must be owner or have admin permission
    (asserts! (or 
      (is-eq caller (get owner (unwrap-panic owner-data)))
      (has-admin-permission document-hash caller)
    ) ERR-UNAUTHORIZED)
    
    ;; Check if already granted
    (asserts! (is-none (map-get? access-control { hash: document-hash, user: user })) ERR-ALREADY-GRANTED)
    
    ;; Check max users limit
    (asserts! (< user-count MAX-USERS-PER-TIMESTAMP) ERR-UNAUTHORIZED)
    
    ;; Grant access
    (map-set access-control
      { hash: document-hash, user: user }
      {
        permission: permission,
        granted-by: caller,
        granted-at: current-time,
        granted-block: current-block
      }
    )
    
    ;; Update tracking
    (update-hash-user-tracking document-hash user)
    (update-user-hash-tracking user document-hash)
    
    ;; Increment total grants
    (var-set total-grants (+ (var-get total-grants) u1))
    
    ;; Emit event
    (print {
      event: "access-granted",
      hash: document-hash,
      user: user,
      permission: permission,
      granted-by: caller,
      timestamp: current-time
    })
    
    (ok true)
  )
)

;; Revoke access from a user
;; @param document-hash: Hash to revoke access from
;; @param user: Principal to revoke access
;; @returns: (response bool uint)
(define-public (revoke-access
    (document-hash (buff 32))
    (user principal)
  )
  (let
    (
      (caller tx-sender)
      (owner-data (map-get? timestamp-owners { hash: document-hash }))
      (access-data (map-get? access-control { hash: document-hash, user: user }))
    )
    ;; Validate
    (asserts! (is-some owner-data) ERR-NOT-FOUND)
    (asserts! (is-some access-data) ERR-NOT-FOUND)
    
    ;; Check authorization: caller must be owner or admin
    (asserts! (or
      (is-eq caller (get owner (unwrap-panic owner-data)))
      (has-admin-permission document-hash caller)
    ) ERR-UNAUTHORIZED)
    
    ;; Revoke access
    (map-delete access-control { hash: document-hash, user: user })
    
    ;; Emit event
    (print {
      event: "access-revoked",
      hash: document-hash,
      user: user,
      revoked-by: caller
    })
    
    (ok true)
  )
)

;; Update user permission level
;; @param document-hash: Hash to update permission for
;; @param user: User to update
;; @param new-permission: New permission level
;; @returns: (response bool uint)
(define-public (update-permission
    (document-hash (buff 32))
    (user principal)
    (new-permission (string-ascii 10))
  )
  (let
    (
      (caller tx-sender)
      (owner-data (map-get? timestamp-owners { hash: document-hash }))
      (access-data (unwrap! (map-get? access-control { hash: document-hash, user: user }) ERR-NOT-FOUND))
    )
    ;; Validate
    (asserts! (is-some owner-data) ERR-NOT-FOUND)
    (asserts! (is-valid-permission new-permission) ERR-INVALID-PERMISSION)
    
    ;; Check authorization
    (asserts! (or
      (is-eq caller (get owner (unwrap-panic owner-data)))
      (has-admin-permission document-hash caller)
    ) ERR-UNAUTHORIZED)
    
    ;; Update permission
    (map-set access-control
      { hash: document-hash, user: user }
      (merge access-data { permission: new-permission })
    )
    
    ;; Emit event
    (print {
      event: "permission-updated",
      hash: document-hash,
      user: user,
      new-permission: new-permission,
      updated-by: caller
    })
    
    (ok true)
  )
)

;; Batch grant access to multiple users
;; @param document-hash: Hash to grant access to
;; @param users: List of principals
;; @param permissions: List of permission levels (must match users length)
;; @returns: (response uint uint) Number of successful grants
(define-public (batch-grant-access
    (document-hash (buff 32))
    (users (list 10 principal))
    (permissions (list 10 (string-ascii 10)))
  )
  (let
    (
      (caller tx-sender)
      (owner-data (map-get? timestamp-owners { hash: document-hash }))
    )
    ;; Validate ownership
    (asserts! (is-some owner-data) ERR-NOT-FOUND)
    (asserts! (or
      (is-eq caller (get owner (unwrap-panic owner-data)))
      (has-admin-permission document-hash caller)
    ) ERR-UNAUTHORIZED)
    
    ;; Note: Actual batch processing would use fold or map
    ;; This is a simplified version
    (ok u0)
  )
)

;; Read-Only Functions

;; Check if a user has specific permission for a hash
;; @param document-hash: Hash to check
;; @param user: User to check
;; @returns: (optional permission-record)
(define-read-only (get-permission (document-hash (buff 32)) (user principal))
  (map-get? access-control { hash: document-hash, user: user })
)

;; Check if user has at least viewer permission
;; @param document-hash: Hash to check
;; @param user: User to check
;; @returns: bool
(define-read-only (has-viewer-permission (document-hash (buff 32)) (user principal))
  (match (map-get? access-control { hash: document-hash, user: user })
    access-data (or
      (is-eq (get permission access-data) PERMISSION-VIEWER)
      (is-eq (get permission access-data) PERMISSION-EDITOR)
      (is-eq (get permission access-data) PERMISSION-ADMIN)
    )
    false
  )
)

;; Check if user has editor permission
;; @param document-hash: Hash to check
;; @param user: User to check
;; @returns: bool
(define-read-only (has-editor-permission (document-hash (buff 32)) (user principal))
  (match (map-get? access-control { hash: document-hash, user: user })
    access-data (or
      (is-eq (get permission access-data) PERMISSION-EDITOR)
      (is-eq (get permission access-data) PERMISSION-ADMIN)
    )
    false
  )
)

;; Check if user has admin permission
;; @param document-hash: Hash to check
;; @param user: User to check
;; @returns: bool
(define-read-only (has-admin-permission (document-hash (buff 32)) (user principal))
  (match (map-get? access-control { hash: document-hash, user: user })
    access-data (is-eq (get permission access-data) PERMISSION-ADMIN)
    false
  )
)

;; Get timestamp owner
;; @param document-hash: Hash to query
;; @returns: (optional principal)
(define-read-only (get-timestamp-owner (document-hash (buff 32)))
  (get owner (map-get? timestamp-owners { hash: document-hash }))
)

;; Check if user is owner
;; @param document-hash: Hash to check
;; @param user: User to check
;; @returns: bool
(define-read-only (is-owner (document-hash (buff 32)) (user principal))
  (match (map-get? timestamp-owners { hash: document-hash })
    owner-data (is-eq user (get owner owner-data))
    false
  )
)

;; Get number of users with access to a hash
;; @param document-hash: Hash to query
;; @returns: uint
(define-read-only (get-hash-user-count (document-hash (buff 32)))
  (default-to u0
    (get count (map-get? hash-user-count { hash: document-hash }))
  )
)

;; Get user at specific index for a hash
;; @param document-hash: Hash to query
;; @param index: Index to query
;; @returns: (optional principal)
(define-read-only (get-hash-user-by-index (document-hash (buff 32)) (index uint))
  (get user (map-get? hash-users { hash: document-hash, index: index }))
)

;; Get number of hashes accessible to a user
;; @param user: User to query
;; @returns: uint
(define-read-only (get-user-hash-count (user principal))
  (default-to u0
    (get count (map-get? user-hash-count { user: user }))
  )
)

;; Get hash at specific index for a user
;; @param user: User to query
;; @param index: Index to query
;; @returns: (optional buff)
(define-read-only (get-user-hash-by-index (user principal) (index uint))
  (get hash (map-get? user-accessible-hashes { user: user, index: index }))
)

;; Get total number of access grants
;; @returns: uint
(define-read-only (get-total-grants)
  (var-get total-grants)
)

;; Private Functions

;; Validate permission string
;; @param permission: Permission to validate
;; @returns: bool
(define-private (is-valid-permission (permission (string-ascii 10)))
  (or
    (is-eq permission PERMISSION-VIEWER)
    (is-eq permission PERMISSION-EDITOR)
    (is-eq permission PERMISSION-ADMIN)
  )
)

;; Update hash-to-users tracking
;; @param hash: Document hash
;; @param user: User principal
;; @returns: bool
(define-private (update-hash-user-tracking (hash (buff 32)) (user principal))
  (let
    (
      (current-count (get-hash-user-count hash))
    )
    ;; Store user at current index
    (map-set hash-users
      { hash: hash, index: current-count }
      { user: user }
    )
    
    ;; Increment count
    (map-set hash-user-count
      { hash: hash }
      { count: (+ current-count u1) }
    )
    
    true
  )
)

;; Update user-to-hashes tracking
;; @param user: User principal
;; @param hash: Document hash
;; @returns: bool
(define-private (update-user-hash-tracking (user principal) (hash (buff 32)))
  (let
    (
      (current-count (get-user-hash-count user))
    )
    ;; Store hash at current index
    (map-set user-accessible-hashes
      { user: user, index: current-count }
      { hash: hash }
    )
    
    ;; Increment count
    (map-set user-hash-count
      { user: user }
      { count: (+ current-count u1) }
    )
    
    true
  )
)

