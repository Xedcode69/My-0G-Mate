// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract CompanionRegistry {
    struct Companion {
        uint256 id;
        address owner;
        string companionType;
        uint256 createdAt;
        uint8 evolutionStage;
        string latestArchiveRootHash;
        uint64 archiveVersion;
    }

    uint256 private nextCompanionId = 1;
    mapping(uint256 => Companion) private companions;
    mapping(address => uint256[]) private ownerCompanions;

    event CompanionCreated(uint256 indexed companionId, address indexed owner, string companionType, uint256 createdAt);
    event CompanionEvolved(uint256 indexed companionId, uint8 evolutionStage);
    event CompanionArchiveUpdated(uint256 indexed companionId, string rootHash, uint64 archiveVersion);
    event CompanionTransferred(uint256 indexed companionId, address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error CompanionNotFound();
    error InvalidOwner();
    error InvalidArchiveVersion();

    function createCompanion(string calldata companionType) external returns (uint256 companionId) {
        companionId = nextCompanionId++;
        companions[companionId] = Companion({
            id: companionId,
            owner: msg.sender,
            companionType: companionType,
            createdAt: block.timestamp,
            evolutionStage: 1,
            latestArchiveRootHash: "",
            archiveVersion: 0
        });
        ownerCompanions[msg.sender].push(companionId);
        emit CompanionCreated(companionId, msg.sender, companionType, block.timestamp);
    }

    function ownerOfCompanion(uint256 companionId) external view returns (address) {
        Companion memory companion = companions[companionId];
        if (companion.owner == address(0)) revert CompanionNotFound();
        return companion.owner;
    }

    function getCompanion(uint256 companionId) external view returns (Companion memory) {
        Companion memory companion = companions[companionId];
        if (companion.owner == address(0)) revert CompanionNotFound();
        return companion;
    }

    function getCompanionsByOwner(address owner) external view returns (uint256[] memory) {
        return ownerCompanions[owner];
    }

    function recordEvolution(uint256 companionId, uint8 evolutionStage) external {
        Companion storage companion = companions[companionId];
        if (companion.owner == address(0)) revert CompanionNotFound();
        if (companion.owner != msg.sender) revert NotOwner();
        companion.evolutionStage = evolutionStage;
        emit CompanionEvolved(companionId, evolutionStage);
    }

    function updateArchive(uint256 companionId, string calldata rootHash, uint64 archiveVersion) external {
        Companion storage companion = companions[companionId];
        if (companion.owner == address(0)) revert CompanionNotFound();
        if (companion.owner != msg.sender) revert NotOwner();
        if (bytes(rootHash).length == 0 || archiveVersion <= companion.archiveVersion) revert InvalidArchiveVersion();

        companion.latestArchiveRootHash = rootHash;
        companion.archiveVersion = archiveVersion;
        emit CompanionArchiveUpdated(companionId, rootHash, archiveVersion);
    }

    function transferCompanion(uint256 companionId, address newOwner) external {
        Companion storage companion = companions[companionId];
        if (companion.owner == address(0)) revert CompanionNotFound();
        if (companion.owner != msg.sender) revert NotOwner();
        if (newOwner == address(0)) revert InvalidOwner();

        address previousOwner = companion.owner;
        _removeOwnerCompanion(previousOwner, companionId);
        companion.owner = newOwner;
        ownerCompanions[newOwner].push(companionId);
        emit CompanionTransferred(companionId, previousOwner, newOwner);
    }

    function _removeOwnerCompanion(address owner, uint256 companionId) private {
        uint256[] storage ids = ownerCompanions[owner];
        for (uint256 index = 0; index < ids.length; index++) {
            if (ids[index] == companionId) {
                ids[index] = ids[ids.length - 1];
                ids.pop();
                return;
            }
        }
    }
}
