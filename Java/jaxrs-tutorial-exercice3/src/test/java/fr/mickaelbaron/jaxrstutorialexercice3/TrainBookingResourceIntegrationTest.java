package fr.mickaelbaron.jaxrstutorialexercice3;

import java.util.List;
import java.util.logging.Level;

import org.glassfish.jersey.logging.LoggingFeature;
import org.glassfish.jersey.server.ResourceConfig;
import org.glassfish.jersey.test.JerseyTest;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import jakarta.ws.rs.client.Entity;
import jakarta.ws.rs.core.Application;
import jakarta.ws.rs.core.GenericType;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;

/**
 * Tests d'intégration de la ressource « réservation de billets de train ».
 *
 * @author Mickael BARON (baron.mickael@gmail.com)
 */
public class TrainBookingResourceIntegrationTest extends JerseyTest {

	@Override
	protected Application configure() {
		ResourceConfig resourceConfig = new ResourceConfig(TrainResource.class, TrainBookingResource.class);
		resourceConfig.property(LoggingFeature.LOGGING_FEATURE_LOGGER_LEVEL_SERVER, Level.WARNING.getName());
		return resourceConfig;
	}

	// La « base de données » est statique et en mémoire : on la remet à zéro
	// avant chaque test pour garantir leur isolation.
	@BeforeEach
	public void resetDatabase() {
		TrainBookingDB.getTrainBookings().clear();
	}

	private TrainBooking createTrainBooking(String trainId, int numberPlaces) {
		TrainBooking trainBooking = new TrainBooking();
		trainBooking.setNumberPlaces(numberPlaces);
		trainBooking.setTrainId(trainId);
		Response response = target("/trains/bookings").request(MediaType.APPLICATION_JSON_TYPE)
				.post(Entity.entity(trainBooking, MediaType.APPLICATION_JSON));
		Assertions.assertEquals(Status.OK.getStatusCode(), response.getStatus(), "Http Response should be 200: ");

		return response.readEntity(TrainBooking.class);
	}

	@Test
	public void createTrainBookingTest() {
		// Given
		TrainBooking trainBooking = new TrainBooking();
		trainBooking.setNumberPlaces(3);
		trainBooking.setTrainId("TR123");

		// When
		Response response = target("/trains/bookings").request(MediaType.APPLICATION_JSON_TYPE)
				.post(Entity.entity(trainBooking, MediaType.APPLICATION_JSON));

		// Then
		Assertions.assertEquals(Status.OK.getStatusCode(), response.getStatus(), "Http Response should be 200: ");
	}

	@Test
	public void createTrainBookingWithBadTrainIdTest() {
		// Given
		TrainBooking trainBooking = new TrainBooking();
		trainBooking.setNumberPlaces(3);
		trainBooking.setTrainId("BADTR123");

		// When
		Response response = target("/trains/bookings").request(MediaType.APPLICATION_JSON_TYPE)
				.post(Entity.entity(trainBooking, MediaType.APPLICATION_JSON));

		// Then
		Assertions.assertEquals(Status.NOT_FOUND.getStatusCode(), response.getStatus(),
				"Http Response should be 404: ");
	}

	@Test
	public void getTrainBookingsTest() {
		// Given
		TrainBooking currentTrainBooking = createTrainBooking("TR123", 3);

		// When
		Response response = target("/trains/bookings").request(MediaType.APPLICATION_JSON_TYPE).get();

		// Then
		Assertions.assertEquals(Status.OK.getStatusCode(), response.getStatus(), "Http Response should be 200: ");
		List<TrainBooking> readEntities = response.readEntity(new GenericType<List<TrainBooking>>() {
		});
		Assertions.assertEquals(1, readEntities.size());
		Assertions.assertEquals(currentTrainBooking.getTrainId(), readEntities.get(0).getTrainId());
	}

	@Test
	public void getTrainBookingTest() {
		// Given
		TrainBooking currentTrainBooking = createTrainBooking("TR123", 3);

		// When
		Response response = target("/trains/bookings").path(currentTrainBooking.getId())
				.request(MediaType.APPLICATION_JSON_TYPE).get();

		// Then
		Assertions.assertEquals(Status.OK.getStatusCode(), response.getStatus(), "Http Response should be 200: ");
	}

	@Test
	public void getTrainBookingWithBadTrainBookingIdTest() {
		// Given
		String trainBookingId = "FAKETRAINBOOKINGID";

		// When
		Response response = target("/trains/bookings").path(trainBookingId).request(MediaType.APPLICATION_JSON_TYPE)
				.get();

		// Then
		Assertions.assertEquals(Status.NOT_FOUND.getStatusCode(), response.getStatus(),
				"Http Response should be 404: ");
	}

	@Test
	public void removeTrainBookingTest() {
		// Given
		TrainBooking currentTrainBooking = createTrainBooking("TR123", 3);

		// When
		Response response = target("/trains/bookings").path(currentTrainBooking.getId()).request().delete();

		// Then
		Assertions.assertEquals(Status.NO_CONTENT.getStatusCode(), response.getStatus(),
				"Http Response should be 204: ");
	}

	@Test
	public void removeTrainBookingWithBadTrainBookingIdTest() {
		// Given
		String trainBookingId = "FAKETRAINBOOKINGID";

		// When
		Response response = target("/trains/bookings").path(trainBookingId).request().delete();

		// Then (DELETE est idempotent : 204 même si la ressource n'existe pas)
		Assertions.assertEquals(Status.NO_CONTENT.getStatusCode(), response.getStatus(),
				"Http Response should be 204: ");
	}
}
