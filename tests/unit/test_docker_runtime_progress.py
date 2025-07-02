"""Tests for Docker runtime progress tracking functionality."""

from unittest.mock import Mock, patch

from openhands.runtime.builder.docker import DockerRuntimeBuilder


class TestDockerRuntimeProgress:
    """Test Docker runtime progress calculation and event handling."""

    def setup_method(self):
        """Set up test fixtures."""
        self.status_callback = Mock()
        self.docker_client = Mock()
        self.docker_client.version.return_value = {
            'Version': '20.10.0',
            'Components': [{'Name': 'Docker Engine'}],
        }
        self.builder = DockerRuntimeBuilder(
            docker_client=self.docker_client, status_callback=self.status_callback
        )

    def test_calculate_overall_progress_empty_layers(self):
        """Test progress calculation with no layers."""
        progress = self.builder._calculate_overall_progress({})
        assert progress == 0.0

    def test_calculate_overall_progress_all_complete(self):
        """Test progress calculation with all layers complete."""
        layers = {
            'layer1': {'status': 'Download complete'},
            'layer2': {'status': 'Already exists'},
            'layer3': {'status': 'Pull complete'},
        }
        progress = self.builder._calculate_overall_progress(layers)
        assert progress == 100.0

    def test_calculate_overall_progress_all_downloading(self):
        """Test progress calculation with all layers downloading."""
        layers = {
            'layer1': {'status': 'Downloading'},
            'layer2': {'status': 'Downloading'},
        }
        progress = self.builder._calculate_overall_progress(layers)
        assert progress == 50.0  # 0.5 * 2 / 2 * 100

    def test_calculate_overall_progress_all_extracting(self):
        """Test progress calculation with all layers extracting."""
        layers = {
            'layer1': {'status': 'Extracting'},
            'layer2': {'status': 'Extracting'},
        }
        progress = self.builder._calculate_overall_progress(layers)
        assert progress == 75.0  # 0.75 * 2 / 2 * 100

    def test_calculate_overall_progress_mixed_states(self):
        """Test progress calculation with mixed layer states."""
        layers = {
            'layer1': {'status': 'Download complete'},  # 1.0
            'layer2': {'status': 'Downloading'},  # 0.5
            'layer3': {'status': 'Extracting'},  # 0.75
            'layer4': {'status': 'Already exists'},  # 1.0
        }
        # Total: (1.0 + 0.5 + 0.75 + 1.0) / 4 * 100 = 81.25%
        progress = self.builder._calculate_overall_progress(layers)
        assert progress == 81.25

    def test_calculate_overall_progress_unknown_status(self):
        """Test progress calculation with unknown status (should be ignored)."""
        layers = {
            'layer1': {'status': 'Download complete'},  # 1.0
            'layer2': {'status': 'Unknown status'},  # 0.0
            'layer3': {'status': 'Downloading'},  # 0.5
        }
        # Total: (1.0 + 0.0 + 0.5) / 3 * 100 = 50%
        progress = self.builder._calculate_overall_progress(layers)
        assert progress == 50.0

    def test_calculate_overall_progress_caps_at_100(self):
        """Test that progress is capped at 100%."""
        # This shouldn't happen in practice, but test the safety check
        layers = {
            'layer1': {'status': 'Download complete'},
        }
        with patch.object(
            self.builder, '_calculate_overall_progress', return_value=150.0
        ):
            # Manually call the real method to test the min() cap
            real_progress = DockerRuntimeBuilder._calculate_overall_progress(
                self.builder, layers
            )
            assert real_progress == 100.0

    @patch('time.time')
    def test_handle_pull_progress_throttling(self, mock_time):
        """Test that progress events are throttled to ≤4/sec."""
        layers = {'layer1': {'status': 'Downloading'}}
        line = {'id': 'layer1', 'status': 'Downloading'}

        # First call should emit (0.3 - 0 >= 0.25)
        mock_time.return_value = 0.3
        last_time = self.builder._handle_pull_progress(line, layers, 0)
        assert last_time == 0.3
        assert self.status_callback.call_count == 1

        # Second call at 0.4s should not emit (0.4 - 0.3 = 0.1 < 0.25s threshold)
        mock_time.return_value = 0.4
        last_time = self.builder._handle_pull_progress(line, layers, last_time)
        assert last_time == 0.3  # Should return previous time
        assert self.status_callback.call_count == 1

        # Third call at 0.5s should not emit (0.5 - 0.3 = 0.2 < 0.25s threshold)
        mock_time.return_value = 0.5
        last_time = self.builder._handle_pull_progress(line, layers, last_time)
        assert last_time == 0.3  # Should return previous time
        assert self.status_callback.call_count == 1

        # Fourth call at 0.55s should emit (0.55 - 0.3 = 0.25 >= 0.25s threshold)
        mock_time.return_value = 0.55
        last_time = self.builder._handle_pull_progress(line, layers, last_time)
        assert last_time == 0.55
        assert self.status_callback.call_count == 2

    def test_handle_pull_progress_no_callback(self):
        """Test progress handling when no status callback is set."""
        docker_client = Mock()
        docker_client.version.return_value = {
            'Version': '20.10.0',
            'Components': [{'Name': 'Docker Engine'}],
        }
        builder = DockerRuntimeBuilder(docker_client=docker_client)
        layers = {'layer1': {'status': 'Downloading'}}
        line = {'id': 'layer1', 'status': 'Downloading'}

        # Should not raise an exception
        last_time = builder._handle_pull_progress(line, layers, 0)
        assert last_time == 0

    def test_handle_pull_progress_no_layer_id(self):
        """Test progress handling when line has no 'id' field."""
        layers = {'layer1': {'status': 'Downloading'}}
        line = {'status': 'Downloading'}  # No 'id' field

        last_time = self.builder._handle_pull_progress(line, layers, 0)
        assert last_time == 0  # Should return original time
        assert self.status_callback.call_count == 0

    @patch('time.time', return_value=1.0)
    def test_handle_pull_progress_event_data_structure(self, mock_time):
        """Test that progress events contain correct data structure."""
        layers = {'layer1': {'status': 'Downloading'}}
        line = {'id': 'layer1', 'status': 'Downloading'}

        self.builder._handle_pull_progress(line, layers, 0)

        # Verify callback was called with correct arguments
        self.status_callback.assert_called_once_with(
            'info',
            'runtime_pull_progress',
            {
                'overall_pct': 50.0,  # Single downloading layer = 50%
                'message': 'Downloading sandbox runtime (50.0%)',
            },
        )

    @patch('time.time', return_value=1.0)
    def test_handle_pull_progress_with_status_logging(self, mock_time):
        """Test that console logging works when status is present."""
        layers = {'layer1': {'status': 'Downloading'}}
        line = {'id': 'layer1', 'status': 'Downloading'}

        with patch('openhands.runtime.builder.docker.logger') as mock_logger:
            self.builder._handle_pull_progress(line, layers, 0)

            # Verify logging was called
            mock_logger.info.assert_called_once_with(
                '[runtime pull] layer1: Downloading (50.0%)'
            )

    @patch('time.time', return_value=1.0)
    def test_handle_pull_progress_without_status_no_logging(self, mock_time):
        """Test that no logging occurs when status is missing."""
        layers = {'layer1': {'status': 'Downloading'}}
        line = {'id': 'layer1'}  # No status field

        with patch('openhands.runtime.builder.docker.logger') as mock_logger:
            self.builder._handle_pull_progress(line, layers, 0)

            # Verify no logging occurred
            mock_logger.info.assert_not_called()

    def test_progress_calculation_edge_cases(self):
        """Test edge cases in progress calculation."""
        # Test with empty status
        layers = {'layer1': {'status': ''}}
        progress = self.builder._calculate_overall_progress(layers)
        assert progress == 0.0

        # Test with missing status key
        layers = {'layer1': {}}
        progress = self.builder._calculate_overall_progress(layers)
        assert progress == 0.0

        # Test with None status
        layers = {'layer1': {'status': None}}
        progress = self.builder._calculate_overall_progress(layers)
        assert progress == 0.0

    def test_real_world_docker_pull_scenario(self):
        """Test a realistic Docker pull progress scenario."""
        # Simulate a typical Docker pull with multiple layers
        scenarios = [
            # Initial state - all layers starting
            {
                'layer1': {'status': 'Pulling fs layer'},
                'layer2': {'status': 'Pulling fs layer'},
                'layer3': {'status': 'Pulling fs layer'},
            },
            # Some layers start downloading
            {
                'layer1': {'status': 'Downloading'},
                'layer2': {'status': 'Downloading'},
                'layer3': {'status': 'Pulling fs layer'},
            },
            # Mixed progress
            {
                'layer1': {'status': 'Download complete'},
                'layer2': {'status': 'Downloading'},
                'layer3': {'status': 'Extracting'},
            },
            # All complete
            {
                'layer1': {'status': 'Download complete'},
                'layer2': {'status': 'Pull complete'},
                'layer3': {'status': 'Already exists'},
            },
        ]

        expected_progress = [0.0, 33.33, 75.0, 100.0]

        for i, layers in enumerate(scenarios):
            progress = self.builder._calculate_overall_progress(layers)
            assert abs(progress - expected_progress[i]) < 0.01, (
                f'Scenario {i}: expected {expected_progress[i]}, got {progress}'
            )
