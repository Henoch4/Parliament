// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Parliament is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable governanceToken;
    IERC20 public immutable treasuryToken;

    uint256 public constant VOTING_PERIOD = 3 days;
    uint256 public constant EXECUTION_DELAY = 1 days;
    uint256 public constant QUORUM = 100;
    uint256 public constant PROPOSAL_THRESHOLD = 1000;

    uint256 public proposalCount;
    uint256 public totalVotingPower;

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(address => uint256) public votingPower;

    struct Proposal {
        address proposer;
        string description;
        address target;
        uint256 value;
        bytes callData;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 startTime;
        uint256 eta;
        bool executed;
        bool canceled;
    }

    event ProposalCreated(uint256 indexed id, address indexed proposer, string description, address target, uint256 value, bytes callData, uint256 startTime, uint256 eta);
    event VoteCast(uint256 indexed id, address indexed voter, bool support, uint256 votes);
    event ProposalExecuted(uint256 indexed id);
    event ProposalCanceled(uint256 indexed id);
    event TreasuryDeposit(address indexed user, uint256 amount);
    event TreasuryWithdraw(address indexed to, uint256 amount);

    constructor(address _governanceToken, address _treasuryToken) Ownable(msg.sender) {
        governanceToken = IERC20(_governanceToken);
        treasuryToken = IERC20(_treasuryToken);
    }

    function syncVotingPower(address user) public {
        uint256 balance = governanceToken.balanceOf(user);
        votingPower[user] = balance;
        totalVotingPower = governanceToken.totalSupply();
    }

    function createProposal(string memory description, address target, uint256 value, bytes memory callData) external nonReentrant returns (uint256) {
        syncVotingPower(msg.sender);
        require(votingPower[msg.sender] >= PROPOSAL_THRESHOLD, "Below threshold");
        uint256 id = proposalCount++;
        proposals[id] = Proposal({
            proposer: msg.sender,
            description: description,
            target: target,
            value: value,
            callData: callData,
            forVotes: 0,
            againstVotes: 0,
            startTime: block.timestamp,
            eta: 0,
            executed: false,
            canceled: false
        });
        emit ProposalCreated(id, msg.sender, description, target, value, callData, block.timestamp, 0);
        return id;
    }

    function castVote(uint256 id, bool support) external nonReentrant {
        Proposal storage p = proposals[id];
        require(!p.executed, "Executed");
        require(!p.canceled, "Canceled");
        require(!hasVoted[id][msg.sender], "Already voted");
        require(block.timestamp <= p.startTime + VOTING_PERIOD, "Voting ended");
        syncVotingPower(msg.sender);
        uint256 votes = votingPower[msg.sender];
        require(votes > 0, "No voting power");
        hasVoted[id][msg.sender] = true;
        if (support) {
            p.forVotes += votes;
        } else {
            p.againstVotes += votes;
        }
        emit VoteCast(id, msg.sender, support, votes);
    }

    function executeProposal(uint256 id) external nonReentrant {
        Proposal storage p = proposals[id];
        require(!p.executed, "Executed");
        require(!p.canceled, "Canceled");
        require(block.timestamp > p.startTime + VOTING_PERIOD, "Voting not ended");
        require(block.timestamp > p.startTime + VOTING_PERIOD + EXECUTION_DELAY, "Execution delay");
        require(p.forVotes > p.againstVotes, "Not passed");
        require(p.forVotes + p.againstVotes >= QUORUM, "Quorum not reached");
        p.executed = true;
        p.eta = block.timestamp;
        (bool success, ) = p.target.call{value: p.value}(p.callData);
        require(success, "Execution failed");
        emit ProposalExecuted(id);
    }

    function cancelProposal(uint256 id) external nonReentrant {
        Proposal storage p = proposals[id];
        require(msg.sender == p.proposer || msg.sender == owner(), "Not authorized");
        require(!p.executed, "Executed");
        p.canceled = true;
        emit ProposalCanceled(id);
    }

    function depositTreasury(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        treasuryToken.safeTransferFrom(msg.sender, address(this), amount);
        emit TreasuryDeposit(msg.sender, amount);
    }

    function withdrawTreasury(address to, uint256 amount) external nonReentrant onlyOwner {
        require(amount > 0, "Amount must be > 0");
        treasuryToken.safeTransfer(to, amount);
        emit TreasuryWithdraw(to, amount);
    }

    function getProposal(uint256 id) external view returns (Proposal memory) {
        return proposals[id];
    }

    function getVotingPower(address user) external view returns (uint256) {
        return votingPower[user];
    }
}
