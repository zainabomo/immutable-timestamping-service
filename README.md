# Immutable Timestamping Service for Digital Documents

A blockchain-based platform that provides cryptographically verifiable, immutable timestamps for digital documents using the Stacks blockchain and Bitcoin's security. This service enables organizations and individuals to prove document existence and integrity at specific points in time, with proof anchored to the Bitcoin blockchain through Stacks' Proof of Transfer (PoX) consensus mechanism.

## Key Features

- **Immutable Document Timestamps**: Register document hashes on the Stacks blockchain with millisecond precision
- **Bitcoin-Secured Proofs**: Leverage Stacks' PoX consensus mechanism for Bitcoin-level security guarantees
- **Decentralized Verification**: Independently verify document authenticity without relying on centralized authorities
- **Privacy-Preserving Hashing**: Client-side SHA-256 hashing preserves user privacy
- **OpenTimestamps Compatible**: Generate industry-standard proof formats for long-term validity
- **Comprehensive Audit Trails**: Maintain tamper-proof records for regulatory compliance (GDPR, SOX, HIPAA)
- **Multi-Format Support**: Timestamp documents in PDF, DOCX, images, and other formats

## Architecture Overview

The system consists of four main layers:

1. **Frontend Layer**: Next.js/React web application for document upload, verification, and proof management
2. **Backend API Layer**: Node.js/Express server handling document processing, blockchain interaction, and user management
3. **Smart Contract Layer**: Clarity smart contracts on Stacks blockchain managing timestamp registry and access control
4. **Blockchain Layer**: Stacks blockchain with Bitcoin settlement for immutable proof storage

Data flows from the frontend through the API to smart contracts, with timestamps ultimately anchored to Bitcoin through Stacks' PoX mechanism.

## Technology Stack

### Frontend
- Next.js 14+ with React 18+
- TypeScript for type safety
- TailwindCSS for styling
- Zustand for state management
- Web3.js for blockchain interaction

### Backend
- Node.js 18+ with Express.js
- TypeScript
- PostgreSQL for relational data
- Redis for caching
- IPFS for distributed proof storage

### Blockchain
- Stacks blockchain (mainnet/testnet/devnet)
- Clarity smart contracts
- Bitcoin for final settlement

### Development & Infrastructure
- Clarinet for Clarity contract development and testing
- Vitest for unit testing
- Docker for containerization
- TypeScript for type safety across the stack

## Prerequisites

Before setting up the project, ensure you have the following installed:

- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 9.0.0 or higher (or yarn 3.6.0+)
- **Docker**: Version 20.10 or higher (for local blockchain development)
- **Git**: Version 2.30 or higher
- **Clarinet**: Version 2.0 or higher (for smart contract development)

Verify installations:

```bash
node --version
npm --version
docker --version
clarinet --version
```

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/Immutable-Timestamping-Service-for-Digital-Documents.git
cd Immutable-Timestamping-Service-for-Digital-Documents
```

### 2. Install Dependencies

Install root-level dependencies:

```bash
npm install
```

### 3. Environment Configuration

Create a `.env.local` file in the project root with the following variables:

```bash
# Stacks Network Configuration
STACKS_NETWORK=devnet
STACKS_API_URL=http://localhost:3999
STACKS_RPC_URL=http://localhost:20443

# Bitcoin Configuration
BITCOIN_NETWORK=regtest
BITCOIN_RPC_URL=http://localhost:18443

# Database Configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/timestamping_db
REDIS_URL=redis://localhost:6379

# IPFS Configuration
IPFS_API_URL=http://localhost:5001
IPFS_GATEWAY_URL=http://localhost:8080

# Application Configuration
NODE_ENV=development
API_PORT=3000
API_URL=http://localhost:3000

# Wallet Configuration (for testnet/mainnet)
DEPLOYER_MNEMONIC=<your-mnemonic-here>
DEPLOYER_ADDRESS=<your-stacks-address>
```

### 4. Smart Contract Setup

Initialize the Clarinet project:

```bash
clarinet check
```

Deploy contracts to devnet:

```bash
clarinet integrate
```

For testnet deployment, update `settings/Testnet.toml` with your mnemonic:

```toml
[accounts.deployer]
mnemonic = "<YOUR PRIVATE TESTNET MNEMONIC HERE>"
```

Then deploy:

```bash
clarinet deployment testnet
```

### 5. Database Setup

Create the PostgreSQL database:

```bash
createdb timestamping_db
```

Run migrations (when available):

```bash
npm run db:migrate
```

## Configuration

### Stacks Network Selection

The project supports three Stacks networks:

**Devnet** (Local Development):
```bash
STACKS_NETWORK=devnet
STACKS_API_URL=http://localhost:3999
```

**Testnet** (Testing):
```bash
STACKS_NETWORK=testnet
STACKS_API_URL=https://api.testnet.hiro.so
```

**Mainnet** (Production):
```bash
STACKS_NETWORK=mainnet
STACKS_API_URL=https://api.hiro.so
```

### Clarinet Configuration

Network-specific settings are in the `settings/` directory:

- `settings/Devnet.toml`: Local development configuration with test accounts
- `settings/Testnet.toml`: Testnet configuration
- `settings/Mainnet.toml`: Mainnet configuration

## Usage

### Starting Development Environment

Start the local Stacks devnet:

```bash
clarinet devnet start
```

In a new terminal, run tests:

```bash
npm run test
```

Watch mode for continuous testing:

```bash
npm run test:watch
```

Generate coverage and cost reports:

```bash
npm run test:report
```

### Running Smart Contract Tests

Tests are located in the `tests/` directory and use Vitest with Clarinet SDK:

```bash
npm run test
```

### Accessing the Stacks Devnet

Once devnet is running, access these services:

- **Stacks Explorer**: http://localhost:8000
- **Stacks API**: http://localhost:3999
- **Bitcoin Explorer**: http://localhost:8001
- **Faucet**: Available through Stacks Explorer

### Test Accounts

Pre-configured test accounts are available in `settings/Devnet.toml`:

- **Deployer**: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM (100M STX)
- **Wallet 1**: ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5 (100M STX)
- **Wallet 2**: ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG (100M STX)

Additional test wallets (3-8) and faucet account are also available.

## Project Structure

```
.
├── contracts/                    # Clarity smart contracts
│   └── (contract files)
├── tests/                        # Smart contract unit tests
│   └── (test files)
├── settings/                     # Network configuration files
│   ├── Devnet.toml              # Local development settings
│   ├── Testnet.toml             # Testnet settings
│   └── Mainnet.toml             # Mainnet settings
├── Clarinet.toml                # Clarinet project configuration
├── package.json                 # Project dependencies and scripts
├── tsconfig.json                # TypeScript configuration
├── vitest.config.js             # Vitest configuration for testing
├── PRODUCT_REQUIREMENTS.md      # Detailed product specification
└── README.md                    # This file
```

## Development

### Running Tests

Execute all tests:

```bash
npm run test
```

Run tests with coverage and cost analysis:

```bash
npm run test:report
```

Watch mode for development:

```bash
npm run test:watch
```

### Code Quality

The project uses strict TypeScript settings for type safety:

```bash
npm run type-check
```

### Building for Production

Build the project:

```bash
npm run build
```

## Smart Contracts

The Clarity smart contracts implement the core timestamping functionality:

### Core Functions

- **register-timestamp**: Register a document hash on the blockchain
- **verify-timestamp**: Retrieve and verify a timestamp
- **grant-access**: Grant user access to a timestamp
- **revoke-access**: Revoke user access to a timestamp
- **get-timestamp-history**: Retrieve all timestamps for a document

### Data Structures

- **timestamps**: Map storing document hashes with metadata
- **access-control**: Map managing user permissions
- **verification-cache**: Map caching verification results

See `PRODUCT_REQUIREMENTS.md` for detailed smart contract specifications.

## Deployment

### Devnet Deployment

```bash
clarinet devnet start
clarinet integrate
```

### Testnet Deployment

1. Update `settings/Testnet.toml` with your mnemonic
2. Deploy contracts:

```bash
clarinet deployment testnet
```

### Mainnet Deployment

1. Update `settings/Mainnet.toml` with your mnemonic
2. Ensure sufficient STX for deployment fees
3. Deploy contracts:

```bash
clarinet deployment mainnet
```

For detailed deployment instructions, see the deployment guide in the project documentation.

## API Documentation

The backend API provides endpoints for:

- **Authentication**: User registration, login, MFA
- **Documents**: Upload, retrieve, search, delete
- **Timestamps**: Register, verify, retrieve, batch operations
- **Proofs**: Download, validate, generate certificates
- **Access Control**: Grant/revoke permissions

API documentation is available at `http://localhost:3000/api/docs` when the backend is running.

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Ensure all tests pass and code follows the project's TypeScript and Clarity conventions.

## License

This project is licensed under the ISC License. See the LICENSE file for details.

## Support

For issues, questions, or suggestions:

- Open an issue on GitHub
- Check existing documentation in `PRODUCT_REQUIREMENTS.md`
- Review Stacks documentation at https://docs.stacks.co
- Visit Clarity documentation at https://book.clarity-lang.org

## Additional Resources

- [Stacks Documentation](https://docs.stacks.co)
- [Clarity Language Guide](https://book.clarity-lang.org)
- [Clarinet Documentation](https://docs.hiro.so/clarinet)
- [OpenTimestamps](https://opentimestamps.org)
- [RFC 3161 - Time-Stamp Protocol](https://www.rfc-editor.org/rfc/rfc3161)

