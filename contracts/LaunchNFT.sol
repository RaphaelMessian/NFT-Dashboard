// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title LaunchNFT
 * @dev Simple ERC721 NFT for launch tracking on Hedera Testnet.
 *      - Owner can mint NFTs to any address
 *      - ERC721Enumerable gives us on-chain holder enumeration
 *      - Transfer events are emitted for dashboard tracking
 */
contract LaunchNFT is ERC721, ERC721Enumerable, Ownable {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;
    string private _baseTokenURI;

    event NFTMinted(address indexed to, uint256 indexed tokenId);

    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseURI_
    ) ERC721(name_, symbol_) {
        _baseTokenURI = baseURI_;
    }

    /**
     * @dev Mint a single NFT to `to`.
     */
    function mint(address to) external onlyOwner returns (uint256) {
        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();
        _safeMint(to, tokenId);
        emit NFTMinted(to, tokenId);
        return tokenId;
    }

    /**
     * @dev Batch mint `count` NFTs to `to`.
     */
    function mintBatch(address to, uint256 count) external onlyOwner {
        for (uint256 i = 0; i < count; i++) {
            _tokenIdCounter.increment();
            uint256 tokenId = _tokenIdCounter.current();
            _safeMint(to, tokenId);
            emit NFTMinted(to, tokenId);
        }
    }

    /**
     * @dev Returns the next token ID that will be minted.
     */
    function nextTokenId() external view returns (uint256) {
        return _tokenIdCounter.current() + 1;
    }

    // --- Overrides for ERC721Enumerable ---

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC721Enumerable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
}
