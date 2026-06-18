// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract CompanionRegistry {
    struct Companion {
        uint256 id;
        address owner;
        string companionType;
        uint256 createdAt;
        uint8 evolutionStage;
    }

    uint256 private nextCompanionId = 1;
    mapping(uint256 => Companion) private companions;
    mapping(address => uint256[]) private ownerCompanions;

    event CompanionCreated(uint256 indexed companionId, address indexed owner, string companionType, uint256 createdAt);
    event CompanionEvolved(uint256 indexed companionId, uint8 evolutionStage);

    error NotOwner();
    error CompanionNotFound();

    function createCompanion(string calldata companionType) external returns (uint256 companionId) {
        companionId = nextCompanionId++;
        companions[companionId] = Companion({
            id: companionId,
            owner: msg.sender,
            companionType: companionType,
            createdAt: block.timestamp,
            evolutionStage: 1
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
}
