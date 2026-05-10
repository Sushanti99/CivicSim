"""Probabilistic demographic agent generator for CivicSim."""

from civicsim_agents.sample import (
    Agent,
    check_representativeness,
    format_representativeness_report,
    list_locations,
    load_distributions,
    sample_agents,
)

__all__ = [
    "Agent",
    "check_representativeness",
    "format_representativeness_report",
    "list_locations",
    "load_distributions",
    "sample_agents",
]

__version__ = "0.1.0"
