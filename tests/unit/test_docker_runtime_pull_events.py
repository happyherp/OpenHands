"""Tests for Docker runtime pull event handling."""

from unittest.mock import Mock, patch

import docker.errors

from openhands.runtime.builder.docker import DockerRuntimeBuilder


class TestDockerRuntimePullEvents:
    """Test Docker runtime pull event emission and handling."""

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

    @patch(
        'openhands.runtime.builder.docker.DockerRuntimeBuilder._output_build_progress'
    )
    @patch(
        'openhands.runtime.builder.docker.DockerRuntimeBuilder._handle_pull_progress'
    )
    def test_image_exists_emits_start_event(
        self, mock_handle_progress, mock_output_progress
    ):
        """Test that image_exists emits runtime_pull_start event."""
        # Mock Docker client to simulate image not existing
        self.builder.docker_client.images.get.side_effect = docker.errors.ImageNotFound(
            'Image not found'
        )
        self.builder.docker_client.api.pull.return_value = [
            {'status': 'Pulling from test', 'id': 'latest'},
            {'status': 'Download complete', 'id': 'layer1'},
        ]

        # Mock _handle_pull_progress to return updated time
        mock_handle_progress.return_value = 0.5

        with patch('openhands.runtime.builder.docker.logger'):
            self.builder.image_exists('test:latest', pull_from_repo=True)

        # Verify start event was emitted
        start_calls = [
            call
            for call in self.status_callback.call_args_list
            if call[0][1] == 'runtime_pull_start'
        ]
        assert len(start_calls) == 1
        assert start_calls[0][0] == (
            'info',
            'runtime_pull_start',
            'Downloading sandbox runtime (test:latest) - first run can take a few minutes...',
        )

    @patch(
        'openhands.runtime.builder.docker.DockerRuntimeBuilder._output_build_progress'
    )
    @patch(
        'openhands.runtime.builder.docker.DockerRuntimeBuilder._handle_pull_progress'
    )
    def test_image_exists_emits_complete_event(
        self, mock_handle_progress, mock_output_progress
    ):
        """Test that image_exists emits runtime_pull_complete event."""
        # Mock Docker client to simulate successful pull
        self.builder.docker_client.images.get.side_effect = docker.errors.ImageNotFound(
            'Image not found'
        )
        self.builder.docker_client.api.pull.return_value = [
            {'status': 'Download complete', 'id': 'layer1'},
        ]
        mock_handle_progress.return_value = 0.5

        with patch('openhands.runtime.builder.docker.logger'):
            self.builder.image_exists('test:latest', pull_from_repo=True)

        # Verify complete event was emitted
        complete_calls = [
            call
            for call in self.status_callback.call_args_list
            if call[0][1] == 'runtime_pull_complete'
        ]
        assert len(complete_calls) == 1
        assert complete_calls[0][0] == (
            'info',
            'runtime_pull_complete',
            'Sandbox runtime download complete',
        )

    @patch(
        'openhands.runtime.builder.docker.DockerRuntimeBuilder._output_build_progress'
    )
    def test_image_exists_emits_failed_event_on_exception(self, mock_output_progress):
        """Test that image_exists emits runtime_pull_failed event on error."""
        # Mock Docker client to simulate pull failure
        self.builder.docker_client.images.get.side_effect = docker.errors.ImageNotFound(
            'Image not found'
        )
        self.builder.docker_client.api.pull.side_effect = Exception('Pull failed')

        with patch('openhands.runtime.builder.docker.logger'):
            self.builder.image_exists('test:latest', pull_from_repo=True)

        # Verify failed event was emitted
        failed_calls = [
            call
            for call in self.status_callback.call_args_list
            if call[0][1] == 'runtime_pull_failed'
        ]
        assert len(failed_calls) == 1
        assert 'Pull failed' in failed_calls[0][0][2]

    def test_image_exists_no_pull_when_image_exists(self):
        """Test that no pull events are emitted when image already exists."""
        # Mock Docker client to simulate image existing
        mock_image = Mock()
        self.builder.docker_client.images.get.return_value = mock_image

        result = self.builder.image_exists('test:latest', pull_from_repo=True)

        # Verify no pull events were emitted
        assert self.status_callback.call_count == 0
        assert result is True

    def test_image_exists_no_pull_when_pull_disabled(self):
        """Test that no pull events are emitted when pull_from_repo=False."""
        # Mock Docker client to simulate image not existing
        self.builder.docker_client.images.get.side_effect = docker.errors.ImageNotFound(
            'Image not found'
        )

        result = self.builder.image_exists('test:latest', pull_from_repo=False)

        # Verify no pull events were emitted
        assert self.status_callback.call_count == 0
        assert result is False

    @patch(
        'openhands.runtime.builder.docker.DockerRuntimeBuilder._output_build_progress'
    )
    @patch(
        'openhands.runtime.builder.docker.DockerRuntimeBuilder._handle_pull_progress'
    )
    def test_progress_events_during_pull(
        self, mock_handle_progress, mock_output_progress
    ):
        """Test that progress events are handled during pull."""
        # Mock Docker client pull stream
        pull_stream = [
            {'status': 'Pulling from test', 'id': 'latest'},
            {
                'status': 'Downloading',
                'id': 'layer1',
                'progressDetail': {'current': 50, 'total': 100},
            },
            {
                'status': 'Downloading',
                'id': 'layer2',
                'progressDetail': {'current': 75, 'total': 100},
            },
            {'status': 'Download complete', 'id': 'layer1'},
            {'status': 'Download complete', 'id': 'layer2'},
        ]

        self.builder.docker_client.images.get.side_effect = docker.errors.ImageNotFound(
            'Image not found'
        )
        self.builder.docker_client.api.pull.return_value = pull_stream

        # Track progress handler calls
        progress_times = [0.0, 0.3, 0.6, 0.9, 1.2]
        mock_handle_progress.side_effect = progress_times

        with patch('openhands.runtime.builder.docker.logger'):
            self.builder.image_exists('test:latest', pull_from_repo=True)

        # Verify _handle_pull_progress was called for each stream line
        assert mock_handle_progress.call_count == len(pull_stream)

        # Verify the calls had correct arguments
        for i, call in enumerate(mock_handle_progress.call_args_list):
            line, layers, last_time = call[0]
            assert line == pull_stream[i]
            assert isinstance(layers, dict)
            if i == 0:
                assert last_time == 0.0
            else:
                assert last_time == progress_times[i - 1]

    def test_builder_without_status_callback(self):
        """Test that builder works correctly without status callback."""
        mock_docker_client = Mock()
        mock_docker_client.version.return_value = {
            'Version': '20.10.0',
            'Components': [{'Name': 'Docker Engine'}],
        }
        builder = DockerRuntimeBuilder(docker_client=mock_docker_client)

        # Mock Docker client to simulate image existing
        mock_image = Mock()
        mock_docker_client.images.get.return_value = mock_image

        # Should not raise an exception
        result = builder.image_exists('test:latest', pull_from_repo=True)
        assert result is True

    @patch(
        'openhands.runtime.builder.docker.DockerRuntimeBuilder._output_build_progress'
    )
    def test_event_emission_with_complex_error(self, mock_output_progress):
        """Test error event emission with complex exception details."""
        # Mock Docker client to simulate specific pull failure
        self.builder.docker_client.images.get.side_effect = docker.errors.ImageNotFound(
            'Image not found'
        )

        # Create a complex exception with nested details
        complex_error = Exception('Failed to pull image: authentication required')
        self.builder.docker_client.api.pull.side_effect = complex_error

        with patch('openhands.runtime.builder.docker.logger'):
            self.builder.image_exists('test:latest', pull_from_repo=True)

        # Verify failed event contains error details
        failed_calls = [
            call
            for call in self.status_callback.call_args_list
            if call[0][1] == 'runtime_pull_failed'
        ]
        assert len(failed_calls) == 1
        error_message = failed_calls[0][0][2]
        assert 'authentication required' in error_message

    @patch(
        'openhands.runtime.builder.docker.DockerRuntimeBuilder._output_build_progress'
    )
    @patch(
        'openhands.runtime.builder.docker.DockerRuntimeBuilder._handle_pull_progress'
    )
    def test_event_sequence_order(self, mock_handle_progress, mock_output_progress):
        """Test that events are emitted in correct order."""
        # Mock Docker client
        self.builder.docker_client.images.get.side_effect = docker.errors.ImageNotFound(
            'Image not found'
        )
        self.builder.docker_client.api.pull.return_value = [
            {'status': 'Download complete', 'id': 'layer1'},
        ]
        mock_handle_progress.return_value = 0.5

        with patch('openhands.runtime.builder.docker.logger'):
            self.builder.image_exists('test:latest', pull_from_repo=True)

        # Extract event types in order
        event_types = [call[0][1] for call in self.status_callback.call_args_list]

        # Verify correct sequence: start -> [progress events] -> complete
        assert event_types[0] == 'runtime_pull_start'
        assert event_types[-1] == 'runtime_pull_complete'

        # All middle events should be progress events (if any)
        for event_type in event_types[1:-1]:
            assert event_type == 'runtime_pull_progress'

    def test_status_callback_parameter_validation(self):
        """Test that status_callback parameter is properly stored."""
        mock_docker_client = Mock()
        mock_docker_client.version.return_value = {
            'Version': '20.10.0',
            'Components': [{'Name': 'Docker Engine'}],
        }

        # Test with callback
        callback = Mock()
        builder = DockerRuntimeBuilder(
            docker_client=mock_docker_client, status_callback=callback
        )
        assert builder.status_callback == callback

        # Test without callback
        builder = DockerRuntimeBuilder(docker_client=mock_docker_client)
        assert builder.status_callback is None

    @patch(
        'openhands.runtime.builder.docker.DockerRuntimeBuilder._handle_pull_progress'
    )
    def test_layers_tracking_during_pull(self, mock_handle_progress):
        """Test that _handle_pull_progress is called for each pull line."""
        pull_stream = [
            {
                'status': 'Downloading',
                'id': 'layer1',
                'progressDetail': {'current': 50, 'total': 100},
            },
            {
                'status': 'Downloading',
                'id': 'layer2',
                'progressDetail': {'current': 25, 'total': 100},
            },
            {'status': 'Download complete', 'id': 'layer1', 'progressDetail': {}},
        ]

        self.builder.docker_client.images.get.side_effect = docker.errors.ImageNotFound(
            'Image not found'
        )
        self.builder.docker_client.api.pull.return_value = pull_stream
        mock_handle_progress.return_value = 0.5

        with patch('openhands.runtime.builder.docker.logger'):
            self.builder.image_exists('test:latest', pull_from_repo=True)

        # Verify _handle_pull_progress was called for each line
        assert mock_handle_progress.call_count == 3

        # Verify the lines passed to _handle_pull_progress
        call_args = mock_handle_progress.call_args_list
        assert call_args[0][0][0] == pull_stream[0]  # First line
        assert call_args[1][0][0] == pull_stream[1]  # Second line
        assert call_args[2][0][0] == pull_stream[2]  # Third line

        # Verify layers dict is passed and contains expected data
        layers_dict = call_args[0][0][1]  # layers dict from first call
        assert isinstance(layers_dict, dict)

        # Verify last_progress_time is passed
        assert isinstance(call_args[0][0][2], (int, float))  # last_progress_time
