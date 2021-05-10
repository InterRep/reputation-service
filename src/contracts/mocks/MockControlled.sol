// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../Controlled.sol";

contract MockControlled is Controlled {
    constructor(address backendAddress_) Controlled(backendAddress_) {}

    function isOwner() public view onlyOwner returns (bool) {
        return true;
    }

    function getBackendAddress() public view returns (address) {
        return _backendAddress;
    }
}
